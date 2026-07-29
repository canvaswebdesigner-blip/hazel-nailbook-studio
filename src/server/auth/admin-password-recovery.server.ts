import "@tanstack/react-start/server-only";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/features/admin-auth/admin-auth.schemas";
import type {
  ForgotPasswordResult,
  ResetPasswordResult,
} from "@/features/admin-auth/admin-auth.types";
import { createRequestId } from "@/lib/error-capture";
import {
  clearAdminRecoverySessionCookie,
  clearAdminRecoveryStateCookie,
  getAdminRecoverySessionCookie,
  getAdminRecoveryStateCookie,
  setAdminRecoverySessionCookie,
  setAdminRecoveryStateCookie,
} from "@/server/auth/admin-recovery-cookie.server";
import { generateOpaqueRandomValue, sha256Hex } from "@/server/booking/booking-crypto.server";
import { getPublicSupabaseEnvironment } from "@/server/env.server";
import { getOrCreatePublicSessionId } from "@/server/security/public-session.server";
import { consumePublicRateLimit } from "@/server/security/rate-limit.server";
import { createAdminAuthServerClient } from "@/server/supabase/admin-auth-client.server";

export async function runForgotAdminPassword(input: unknown): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { status: "success" };

  const browserSessionId = getOrCreatePublicSessionId();
  const [sessionLimit, emailLimit] = await Promise.all([
    consumePublicRateLimit({
      identity: browserSessionId,
      limit: 5,
      scope: "admin_password_recovery_session",
      windowSeconds: 60 * 60,
    }),
    consumePublicRateLimit({
      identity: parsed.data.email,
      limit: 3,
      scope: "admin_password_recovery_email",
      windowSeconds: 60 * 60,
    }),
  ]);

  if (!sessionLimit.allowed || !emailLimit.allowed) {
    return {
      retryAfterSeconds: Math.max(sessionLimit.retryAfterSeconds, emailLimit.retryAfterSeconds),
      status: "rate_limited",
    };
  }

  const state = generateOpaqueRandomValue(32);
  setAdminRecoveryStateCookie(state);

  const environment = getPublicSupabaseEnvironment();
  const redirectUrl = new URL("/admin/auth/callback", environment.SITE_URL);
  redirectUrl.searchParams.set("state", state);

  const client = createAdminAuthServerClient();
  await client.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: redirectUrl.toString(),
  });

  return { status: "success" };
}

export async function exchangeAdminRecoveryCode(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const suppliedState = url.searchParams.get("state");
  const expectedState = getAdminRecoveryStateCookie();
  clearAdminRecoveryStateCookie();
  clearAdminRecoverySessionCookie();

  if (
    !code ||
    !suppliedState ||
    !expectedState ||
    !/^[A-Za-z0-9_-]{43}$/.test(suppliedState) ||
    (await sha256Hex(suppliedState)) !== (await sha256Hex(expectedState))
  ) {
    return recoveryRedirect(request.url, false);
  }

  const client = createAdminAuthServerClient();
  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError) return recoveryRedirect(request.url, false);

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    await client.auth.signOut({ scope: "local" });
    return recoveryRedirect(request.url, false);
  }

  const { data: role, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError || !role) {
    await client.auth.signOut({ scope: "local" });
    return recoveryRedirect(request.url, false);
  }

  const recoverySession = generateOpaqueRandomValue(32);
  const recoverySessionHash = await sha256Hex(recoverySession);
  const { error: registerError } = await client.rpc("register_admin_recovery_session", {
    p_request_id: createRequestId(),
    p_session_hash: recoverySessionHash,
  });
  if (registerError) {
    await client.auth.signOut({ scope: "local" });
    return recoveryRedirect(request.url, false);
  }

  setAdminRecoverySessionCookie(recoverySession);
  return recoveryRedirect(request.url, true);
}

export async function getAdminRecoveryStatus(): Promise<boolean> {
  const recoverySession = getAdminRecoverySessionCookie();
  if (!recoverySession) return false;

  const client = createAdminAuthServerClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return false;

  const { data, error } = await client.rpc("current_admin_recovery_session_is_valid", {
    p_session_hash: await sha256Hex(recoverySession),
  });
  return !error && data === true;
}

export async function runResetAdminPassword(input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      message:
        "Şifre en az 12 karakter olmalı; en az bir harf ve bir rakam içermeli. İki alan da aynı olmalı.",
      status: "error",
    };
  }

  const recoverySession = getAdminRecoverySessionCookie();
  if (!recoverySession) {
    return { message: "Kurtarma bağlantısının süresi dolmuş.", status: "error" };
  }

  const client = createAdminAuthServerClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    clearAdminRecoverySessionCookie();
    return { message: "Kurtarma bağlantısının süresi dolmuş.", status: "error" };
  }

  const recoverySessionHash = await sha256Hex(recoverySession);
  const { error: consumeError } = await client.rpc("consume_admin_recovery_session", {
    p_request_id: createRequestId(),
    p_session_hash: recoverySessionHash,
  });
  if (consumeError) {
    clearAdminRecoverySessionCookie();
    await client.auth.signOut({ scope: "local" });
    return { message: "Kurtarma bağlantısının süresi dolmuş.", status: "error" };
  }

  const { error: updateError } = await client.auth.updateUser({
    password: parsed.data.password,
  });
  clearAdminRecoverySessionCookie();

  if (updateError) {
    await client.auth.signOut({ scope: "global" });
    return {
      message: "Şifre güncellenemedi. Yeni bir kurtarma bağlantısı iste.",
      status: "error",
    };
  }

  await client.auth.signOut({ scope: "global" });
  return { status: "success" };
}

function recoveryRedirect(requestUrl: string, successful: boolean): Response {
  const target = new URL(successful ? "/admin/sifre-sifirla" : "/admin/giris", requestUrl);
  if (!successful) target.searchParams.set("durum", "kurtarma-gecersiz");

  return new Response(null, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy":
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      Location: target.toString(),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
    status: 303,
  });
}
