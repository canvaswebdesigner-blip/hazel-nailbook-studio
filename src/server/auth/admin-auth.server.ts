import "@tanstack/react-start/server-only";

import { z } from "zod";

import { adminLoginSchema, mfaVerificationSchema } from "@/features/admin-auth/admin-auth.schemas";
import type {
  AdminAccessState,
  AdminIdentity,
  AdminLoginResult,
  MfaEnrollmentResult,
  MfaVerificationResult,
} from "@/features/admin-auth/admin-auth.types";
import { createRequestId } from "@/lib/error-capture";
import { getOrCreatePublicSessionId } from "@/server/security/public-session.server";
import { consumePublicRateLimit } from "@/server/security/rate-limit.server";
import { createAdminAuthServerClient } from "@/server/supabase/admin-auth-client.server";

const adminSessionRowSchema = z.object({
  absolute_expires_at: z.string().datetime({ offset: true }),
  idle_expires_at: z.string().datetime({ offset: true }),
  recently_reauthenticated_at: z.string().datetime({ offset: true }),
});

const genericLoginMessage = "E-posta veya şifre doğru değil.";
const genericMfaMessage = "Doğrulama kodu kabul edilmedi. Yeni kodu kontrol edip tekrar dene.";

export async function inspectAdminAccess(options?: {
  touchSession?: boolean;
}): Promise<AdminAccessState> {
  const client = createAdminAuthServerClient();
  return inspectAdminAccessWithClient(client, options);
}

export async function createAuthorizedAdminRequestContext() {
  const client = createAdminAuthServerClient();
  const access = await inspectAdminAccessWithClient(client, {
    touchSession: true,
  });

  if (access.status !== "ready") {
    throw new Response("Unauthorized", {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
      status: 401,
    });
  }

  return { access, client };
}

async function inspectAdminAccessWithClient(
  client: ReturnType<typeof createAdminAuthServerClient>,
  options?: { touchSession?: boolean },
): Promise<AdminAccessState> {
  const identityResult = await getAdminIdentity(client);
  if (identityResult.status !== "ready") return identityResult;

  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();

  if (factorError || assuranceError || !factors || !assurance) {
    return { status: "session_expired" };
  }

  const verifiedFactor = factors.totp[0];
  if (!verifiedFactor) {
    return {
      identity: identityResult.identity,
      status: "needs_mfa_enrollment",
    };
  }

  if (assurance.currentLevel !== "aal2") {
    return {
      factorId: verifiedFactor.id,
      identity: identityResult.identity,
      status: "needs_mfa_verification",
    };
  }

  if (!options?.touchSession) {
    return {
      absoluteExpiresAt: "",
      identity: identityResult.identity,
      idleExpiresAt: "",
      recentlyReauthenticatedAt: "",
      status: "ready",
    };
  }

  const session = await registerOrTouchAdminSession(client);
  if (!session) return { status: "session_expired" };

  return {
    absoluteExpiresAt: session.absolute_expires_at,
    identity: identityResult.identity,
    idleExpiresAt: session.idle_expires_at,
    recentlyReauthenticatedAt: session.recently_reauthenticated_at,
    status: "ready",
  };
}

export async function runAdminLogin(input: unknown): Promise<AdminLoginResult> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { message: genericLoginMessage, status: "error" };
  }

  const sessionId = getOrCreatePublicSessionId();
  const [sessionLimit, emailLimit] = await Promise.all([
    consumePublicRateLimit({
      identity: sessionId,
      limit: 8,
      scope: "admin_login_session",
      windowSeconds: 15 * 60,
    }),
    consumePublicRateLimit({
      identity: parsed.data.email,
      limit: 5,
      scope: "admin_login_email",
      windowSeconds: 15 * 60,
    }),
  ]);

  if (!sessionLimit.allowed || !emailLimit.allowed) {
    return {
      retryAfterSeconds: Math.max(sessionLimit.retryAfterSeconds, emailLimit.retryAfterSeconds),
      status: "rate_limited",
    };
  }

  const client = createAdminAuthServerClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) return { message: genericLoginMessage, status: "error" };

  const access = await inspectAdminAccessWithClient(client);
  if (access.status === "forbidden" || access.status === "anonymous") {
    await client.auth.signOut({ scope: "local" });
    return { message: genericLoginMessage, status: "error" };
  }

  if (access.status === "needs_mfa_enrollment") {
    return { nextPath: "/admin/mfa", status: "success" };
  }
  if (access.status === "needs_mfa_verification") {
    return { nextPath: "/admin/mfa-dogrula", status: "success" };
  }
  if (access.status !== "ready") {
    await client.auth.signOut({ scope: "local" });
    return {
      message: "Oturum güvenli biçimde başlatılamadı. Tekrar giriş yap.",
      status: "error",
    };
  }

  const session = await registerOrTouchAdminSession(client);
  if (!session) {
    await client.auth.signOut({ scope: "local" });
    return {
      message: "Oturum güvenli biçimde başlatılamadı. Tekrar giriş yap.",
      status: "error",
    };
  }

  return { nextPath: "/admin", status: "success" };
}

export async function startMfaEnrollment(): Promise<MfaEnrollmentResult> {
  const client = createAdminAuthServerClient();
  const identity = await getAdminIdentity(client);
  if (identity.status !== "ready") {
    return { message: "Bu işlem için yeniden giriş yapmalısın.", status: "error" };
  }

  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  if (factorsError || !factors) {
    return { message: "Güvenlik anahtarı hazırlanamadı.", status: "error" };
  }
  if (factors.totp.length > 0) {
    return {
      message: "İki adımlı doğrulama zaten etkin. Kod doğrulama ekranına geç.",
      status: "error",
    };
  }

  for (const factor of factors.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        return {
          message: "Önceki yarım kalan güvenlik kurulumu temizlenemedi.",
          status: "error",
        };
      }
    }
  }

  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Hazel yönetim paneli",
    issuer: "Hazel Nail Art Studio",
  });
  if (error || !data || data.type !== "totp") {
    return { message: "Güvenlik anahtarı hazırlanamadı.", status: "error" };
  }

  return {
    factorId: data.id,
    qrCodeDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.totp.qr_code)}`,
    secret: data.totp.secret,
    status: "success",
  };
}

export async function runMfaVerification(input: unknown): Promise<MfaVerificationResult> {
  const parsed = mfaVerificationSchema.safeParse(input);
  if (!parsed.success) return { message: genericMfaMessage, status: "error" };

  const sessionId = getOrCreatePublicSessionId();
  const limit = await consumePublicRateLimit({
    identity: sessionId,
    limit: 8,
    scope: "admin_mfa_verify",
    windowSeconds: 10 * 60,
  });
  if (!limit.allowed) {
    return {
      message: `Çok fazla deneme yapıldı. ${limit.retryAfterSeconds} saniye sonra tekrar dene.`,
      status: "error",
    };
  }

  const client = createAdminAuthServerClient();
  const identity = await getAdminIdentity(client);
  if (identity.status !== "ready") {
    return { message: "Oturumun sona erdi. Yeniden giriş yap.", status: "error" };
  }

  const { error } = await client.auth.mfa.challengeAndVerify({
    code: parsed.data.code,
    factorId: parsed.data.factorId,
  });
  if (error) return { message: genericMfaMessage, status: "error" };

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    return { message: genericMfaMessage, status: "error" };
  }

  const session = await registerOrTouchAdminSession(client);
  if (!session) {
    return {
      message: "Güvenli yönetim oturumu başlatılamadı. Yeniden giriş yap.",
      status: "error",
    };
  }

  return { nextPath: "/admin", status: "success" };
}

export async function runAdminLogout(): Promise<void> {
  const client = createAdminAuthServerClient();
  await client.rpc("revoke_current_admin_session", {
    p_request_id: createRequestId(),
  });
  await client.auth.signOut({ scope: "local" });
}

async function getAdminIdentity(
  client: ReturnType<typeof createAdminAuthServerClient>,
): Promise<
  | Readonly<{ identity: AdminIdentity; status: "ready" }>
  | Readonly<{ status: "anonymous" | "forbidden" | "session_expired" }>
> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return { status: "anonymous" };

  const [{ data: role, error: roleError }, { data: profile, error: profileError }] =
    await Promise.all([
      client
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle(),
      client.from("profiles").select("full_name").eq("id", userData.user.id).maybeSingle(),
    ]);

  if (roleError || profileError) return { status: "session_expired" };
  if (!role) return { status: "forbidden" };

  return {
    identity: {
      email: userData.user.email ?? "",
      fullName: profile?.full_name ?? "Hazel",
      userId: userData.user.id,
    },
    status: "ready",
  };
}

async function registerOrTouchAdminSession(
  client: ReturnType<typeof createAdminAuthServerClient>,
): Promise<z.infer<typeof adminSessionRowSchema> | null> {
  const { data, error } = await client.rpc("register_or_touch_admin_session", {
    p_request_id: createRequestId(),
  });
  if (error) return null;

  const parsed = z.array(adminSessionRowSchema).safeParse(data);
  return parsed.success && parsed.data.length === 1 ? parsed.data[0] : null;
}
