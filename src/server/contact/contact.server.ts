import "@tanstack/react-start/server-only";

import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { contactSubmissionSchema } from "@/features/contact/contact.schemas";
import type {
  ContactBootstrap,
  ContactSubmission,
  ContactSubmissionResult,
} from "@/features/contact/contact.types";
import { derivePrivateHmacHex } from "@/server/booking/booking-crypto.server";
import { getOrCreatePublicSessionId } from "@/server/security/public-session.server";
import { consumePublicRateLimit } from "@/server/security/rate-limit.server";
import { createPublicSupabaseServerClient } from "@/server/supabase/public-client.server";
import { createServiceRoleRpcClient } from "@/server/supabase/service-role-client.server";

const policyRowSchema = z.object({
  content: z.string(),
  policy_type: z.enum(["privacy_notice", "booking_terms", "terms_of_use", "cookie_notice"]),
  published_at: z.string().datetime({ offset: true }),
  version: z.string().min(1).max(50),
});
const contactRpcRowSchema = z.object({
  contact_message_id: z.string().uuid(),
  result_kind: z.enum(["created", "replayed"]),
});
const minimumHumanCompletionMilliseconds = 1_500;
const maximumFormLifetimeMilliseconds = 24 * 60 * 60 * 1_000;

export async function getContactBootstrap(): Promise<ContactBootstrap> {
  setResponseHeader("Cache-Control", "private, no-store, max-age=0");

  try {
    const client = createPublicSupabaseServerClient();
    const { data, error } = await client.rpc("get_current_policy_documents");
    if (error) return unavailableBootstrap();

    const policies = z.array(policyRowSchema).safeParse(data);
    if (!policies.success) return unavailableBootstrap();

    const privacyNotice = policies.data.find((policy) => policy.policy_type === "privacy_notice");
    if (!privacyNotice) {
      return {
        message: "İletişim formu için gerekli gizlilik bildirimi henüz yayımlanmadı.",
        status: "not_configured",
      };
    }

    return {
      privacyNotice: {
        publishedAt: privacyNotice.published_at,
        version: privacyNotice.version,
      },
      status: "ready",
    };
  } catch {
    return unavailableBootstrap();
  }
}

export async function runSubmitContactMessage(input: unknown): Promise<ContactSubmissionResult> {
  setResponseHeader("Cache-Control", "private, no-store, max-age=0");
  setResponseHeader("Vary", "Cookie");

  const parsed = contactSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(compactFieldErrors(parsed.error.flatten().fieldErrors));
  }

  const formAge = Date.now() - parsed.data.formStartedAt;
  if (
    parsed.data.website !== "" ||
    formAge < minimumHumanCompletionMilliseconds ||
    formAge > maximumFormLifetimeMilliseconds
  ) {
    return validationFailure();
  }

  try {
    const sessionId = getOrCreatePublicSessionId();
    const contactIdentity = parsed.data.phone ?? parsed.data.email ?? sessionId;
    const [sessionLimit, contactLimit] = await Promise.all([
      consumePublicRateLimit({
        identity: sessionId,
        limit: 8,
        scope: "contact_session",
        windowSeconds: 15 * 60,
      }),
      consumePublicRateLimit({
        identity: contactIdentity,
        limit: 4,
        scope: "contact_identity",
        windowSeconds: 15 * 60,
      }),
    ]);
    const blockedDecision = [sessionLimit, contactLimit].find((decision) => !decision.allowed);
    if (blockedDecision) {
      setResponseHeader("Retry-After", String(blockedDecision.retryAfterSeconds));
      return {
        code: "rate_limited",
        message: "Çok sık mesaj gönderildi. Bir süre sonra tekrar dene.",
        retryAfterSeconds: blockedDecision.retryAfterSeconds,
        status: "error",
      };
    }

    const idempotencyKeyHmac = await derivePrivateHmacHex(
      "idempotency:public_contact:v1",
      parsed.data.idempotencyKey,
    );
    const requestFingerprint = await derivePrivateHmacHex(
      "fingerprint:public_contact:v1",
      canonicalContactTuple(parsed.data),
    );
    const client = createServiceRoleRpcClient();
    const { data, error } = await client.rpc("submit_public_contact_message", {
      p_contact_message_id: crypto.randomUUID(),
      p_email: parsed.data.email,
      p_full_name: parsed.data.fullName,
      p_idempotency_key_hmac: idempotencyKeyHmac,
      p_ip_hmac: null,
      p_message: parsed.data.message,
      p_phone_e164: parsed.data.phone,
      p_privacy_notice_version: parsed.data.privacyNoticeVersion,
      p_request_fingerprint: requestFingerprint,
      p_request_id: crypto.randomUUID(),
      p_user_agent: getRequestHeader("user-agent")?.slice(0, 512) ?? null,
    });
    if (error) return mapContactRpcError(error);

    const result = z.array(contactRpcRowSchema).safeParse(data);
    if (!result.success || result.data.length !== 1) return unavailableSubmission();

    return { status: "success" };
  } catch {
    return unavailableSubmission();
  }
}

function canonicalContactTuple(input: ContactSubmission): string {
  return JSON.stringify([
    "public_contact:v1",
    input.fullName,
    input.phone,
    input.email,
    input.message,
    input.privacyNoticeVersion,
  ]);
}

function mapContactRpcError(error: { code?: string; message?: string }): ContactSubmissionResult {
  if (error.message === "privacy_notice_outdated") {
    return {
      code: "policy_changed",
      message: "Gizlilik bildirimi güncellendi. Sayfayı yenileyip yeni metni onayla.",
      status: "error",
    };
  }

  if (error.message === "idempotency_key_reuse") {
    return {
      code: "idempotency_key_reuse",
      message: "Mesaj bilgileri değişti. Lütfen yeniden onaylayıp gönder.",
      status: "error",
    };
  }

  if (error.code === "22023") return validationFailure();
  return unavailableSubmission();
}

function compactFieldErrors(
  value: Record<string, string[] | undefined>,
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length)),
  );
}

function validationFailure(
  fieldErrors?: Readonly<Record<string, readonly string[]>>,
): ContactSubmissionResult {
  return {
    code: "validation_error",
    fieldErrors,
    message: "İletişim bilgilerini ve mesajını kontrol et.",
    status: "error",
  };
}

function unavailableSubmission(): ContactSubmissionResult {
  return {
    code: "unavailable",
    message: "Mesaj şu anda gönderilemiyor. Lütfen biraz sonra tekrar dene.",
    status: "error",
  };
}

function unavailableBootstrap(): ContactBootstrap {
  return {
    message: "İletişim formu şu anda yüklenemiyor.",
    status: "unavailable",
  };
}
