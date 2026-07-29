import "@tanstack/react-start/server-only";

import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { bookingSubmissionSchema } from "@/features/booking/booking.schemas";
import type {
  BookingFailure,
  BookingPriceType,
  CreateBookingResult,
} from "@/features/booking/booking.types";
import {
  deriveAppointmentCredentials,
  derivePrivateHmacHex,
  generateBookingCode,
} from "@/server/booking/booking-crypto.server";
import { getServiceRoleEnvironment } from "@/server/env.server";
import { getOrCreatePublicSessionId } from "@/server/security/public-session.server";
import { consumePublicRateLimit } from "@/server/security/rate-limit.server";
import { createServiceRoleRpcClient } from "@/server/supabase/service-role-client.server";

const appointmentStatusSchema = z.enum(["confirmed", "completed", "cancelled", "no_show"]);
const bookingRpcRowSchema = z.object({
  appointment_end_at: z.string().datetime({ offset: true }),
  appointment_id: z.string().uuid(),
  appointment_start_at: z.string().datetime({ offset: true }),
  appointment_status: appointmentStatusSchema,
  booking_code: z.string().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8,16}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  duration_minutes: z.number().int().min(15).max(720),
  management_expires_at: z.string().datetime({ offset: true }),
  management_token_version: z.number().int().positive(),
  price_type: z.enum(["fixed", "starting_from", "quote_required"]),
  private_link_reissuable: z.boolean(),
  quoted_price: z
    .union([z.number(), z.string()])
    .nullable()
    .transform((value) => (value === null ? null : String(value))),
  receipt_expires_at: z.string().datetime({ offset: true }),
  result_kind: z.enum(["created", "replayed"]),
  service_name: z.string().min(2).max(120),
  token_key_version: z.number().int().positive(),
});

const minimumHumanCompletionMilliseconds = 1_500;
const maximumFormLifetimeMilliseconds = 24 * 60 * 60 * 1_000;

export async function runCreatePublicBooking(input: unknown): Promise<CreateBookingResult> {
  setResponseHeader("Cache-Control", "private, no-store, max-age=0");
  setResponseHeader("Vary", "Cookie");

  const parsed = bookingSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(compactFieldErrors(parsed.error.flatten().fieldErrors));
  }

  const now = Date.now();
  const formAge = now - parsed.data.formStartedAt;
  if (
    parsed.data.website !== "" ||
    formAge < minimumHumanCompletionMilliseconds ||
    formAge > maximumFormLifetimeMilliseconds
  ) {
    return validationFailure();
  }

  try {
    const sessionId = getOrCreatePublicSessionId();
    const [sessionLimit, phoneLimit] = await Promise.all([
      consumePublicRateLimit({
        identity: sessionId,
        limit: 10,
        scope: "booking_session",
        windowSeconds: 15 * 60,
      }),
      consumePublicRateLimit({
        identity: parsed.data.customer.phone,
        limit: 5,
        scope: "booking_phone",
        windowSeconds: 15 * 60,
      }),
    ]);

    const blockedDecision = [sessionLimit, phoneLimit].find((decision) => !decision.allowed);
    if (blockedDecision) {
      setResponseHeader("Retry-After", String(blockedDecision.retryAfterSeconds));
      return {
        code: "rate_limited",
        message: "Çok sık randevu denemesi yapıldı. Bir süre sonra tekrar dene.",
        retryAfterSeconds: blockedDecision.retryAfterSeconds,
        status: "error",
      };
    }

    const appointmentId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const credentials = await deriveAppointmentCredentials({ appointmentId });
    const idempotencyKeyHmac = await derivePrivateHmacHex(
      "idempotency:public_booking:v1",
      parsed.data.idempotencyKey,
    );
    const requestFingerprint = await derivePrivateHmacHex(
      "fingerprint:public_booking:v1",
      canonicalBookingTuple(parsed.data),
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await executeBookingRpc({
        appointmentId,
        bookingCode: generateBookingCode(),
        credentials,
        idempotencyKeyHmac,
        input: parsed.data,
        requestFingerprint,
        requestId,
      });

      if (result.kind === "booking_code_collision") continue;
      if (result.kind === "error") return result.failure;
      return buildSuccessResult(result.row);
    }

    return unavailable();
  } catch {
    return unavailable();
  }
}

async function executeBookingRpc(input: {
  appointmentId: string;
  bookingCode: string;
  credentials: Awaited<ReturnType<typeof deriveAppointmentCredentials>>;
  idempotencyKeyHmac: string;
  input: z.infer<typeof bookingSubmissionSchema>;
  requestFingerprint: string;
  requestId: string;
}): Promise<
  | { failure: BookingFailure; kind: "error" }
  | { kind: "booking_code_collision" }
  | { kind: "success"; row: z.infer<typeof bookingRpcRowSchema> }
> {
  const client = createServiceRoleRpcClient();
  const { data, error } = await client.rpc("create_public_booking", {
    p_appointment_id: input.appointmentId,
    p_booking_code: input.bookingCode,
    p_booking_terms_version: input.input.bookingTermsVersion,
    p_consent_ip_hmac: null,
    p_customer_note: emptyToNull(input.input.customer.note),
    p_email: emptyToNull(input.input.customer.email),
    p_full_name: input.input.customer.fullName,
    p_idempotency_key_hmac: input.idempotencyKeyHmac,
    p_management_token_hash: input.credentials.managementTokenHash,
    p_phone_e164: input.input.customer.phone,
    p_privacy_notice_version: input.input.privacyNoticeVersion,
    p_receipt_token_hash: input.credentials.receiptTokenHash,
    p_request_fingerprint: input.requestFingerprint,
    p_request_id: input.requestId,
    p_service_id: input.input.serviceId,
    p_start_at: input.input.startAt,
    p_token_key_version: input.credentials.keyVersion,
  });

  if (error) {
    if (isBookingCodeCollision(error)) return { kind: "booking_code_collision" };
    return { failure: mapBookingRpcError(error), kind: "error" };
  }

  const parsed = z.array(bookingRpcRowSchema).safeParse(data);
  if (!parsed.success || parsed.data.length !== 1) {
    return { failure: unavailable(), kind: "error" };
  }

  return { kind: "success", row: parsed.data[0] };
}

async function buildSuccessResult(
  row: z.infer<typeof bookingRpcRowSchema>,
): Promise<CreateBookingResult> {
  const credentials = await deriveAppointmentCredentials({
    appointmentId: row.appointment_id,
    keyVersion: row.token_key_version,
    managementTokenVersion: row.management_token_version,
  }).catch(() => null);
  const environment = getServiceRoleEnvironment();
  const receiptAvailable =
    credentials !== null && new Date(row.receipt_expires_at).getTime() > Date.now();
  const managementAvailable =
    credentials !== null &&
    row.private_link_reissuable &&
    new Date(row.management_expires_at).getTime() > Date.now();

  return {
    appointmentStatus: row.appointment_status,
    bookingCode: row.booking_code,
    currency: row.currency,
    durationMinutes: row.duration_minutes,
    endAt: row.appointment_end_at,
    managementExchangeUrl: managementAvailable
      ? buildPrivateUrl(environment.SITE_URL, "randevu-yonet", credentials!.managementToken)
      : null,
    managementLinkAvailable: managementAvailable,
    priceType: row.price_type as BookingPriceType,
    quotedPrice: row.quoted_price,
    receiptExchangeUrl: receiptAvailable
      ? buildPrivateUrl(environment.SITE_URL, "randevu-basarili", credentials!.receiptToken)
      : null,
    serviceName: row.service_name,
    startAt: row.appointment_start_at,
    status: "success",
    timezone: "Europe/Istanbul",
  };
}

function canonicalBookingTuple(input: z.infer<typeof bookingSubmissionSchema>): string {
  return JSON.stringify([
    "public_booking:v1",
    input.serviceId,
    input.startAt,
    input.customer.fullName,
    input.customer.phone,
    emptyToNull(input.customer.email),
    emptyToNull(input.customer.note),
    input.privacyNoticeVersion,
    input.bookingTermsVersion,
    "web",
  ]);
}

function buildPrivateUrl(siteUrl: string, path: string, token: string): string {
  return new URL(`/${path}/${encodeURIComponent(token)}`, siteUrl).toString();
}

function emptyToNull(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isBookingCodeCollision(error: {
  code?: string;
  details?: string;
  message?: string;
}): boolean {
  if (error.code !== "23505") return false;

  return Boolean(
    error.message?.includes("appointments_booking_code_key") ||
    error.details?.includes("(booking_code)"),
  );
}

function mapBookingRpcError(error: {
  code?: string;
  details?: string;
  message?: string;
}): BookingFailure {
  if (error.code === "23P01" || error.message === "slot_unavailable") {
    return {
      code: "slot_conflict",
      message: "Bu saat az önce dolmuş görünüyor. Sana uygun başka bir saat seç.",
      status: "error",
    };
  }

  if (error.message === "booking_disabled") {
    return {
      code: "booking_disabled",
      message: "Online randevu şu anda geçici olarak kapalı.",
      status: "error",
    };
  }

  if (
    error.message === "booking_provider_unavailable" ||
    error.message === "booking_configuration_unavailable"
  ) {
    return {
      code: "not_configured",
      message: "Online randevu için gerekli işletme bilgileri henüz tamamlanmadı.",
      status: "error",
    };
  }

  if (error.message === "service_unavailable") {
    return {
      code: "service_unavailable",
      message: "Seçilen hizmet artık online randevuya açık değil.",
      status: "error",
    };
  }

  if (error.message === "privacy_notice_outdated" || error.message === "booking_terms_outdated") {
    return {
      code: "policy_changed",
      message: "Randevu koşulları güncellendi. Devam etmeden önce yeni metinleri onayla.",
      status: "error",
    };
  }

  if (error.message === "idempotency_key_reuse") {
    return {
      code: "idempotency_key_reuse",
      message: "Randevu bilgileri değişti. Lütfen işlemi yeniden onayla.",
      status: "error",
    };
  }

  if (error.code === "22023") return validationFailure();
  return unavailable();
}

function validationFailure(
  fieldErrors?: Readonly<Record<string, readonly string[]>>,
): BookingFailure {
  return {
    code: "validation_error",
    fieldErrors,
    message: "Randevu bilgilerini kontrol et.",
    status: "error",
  };
}

function unavailable(): BookingFailure {
  return {
    code: "unavailable",
    message: "Randevu şu anda oluşturulamıyor. Lütfen biraz sonra tekrar dene.",
    status: "error",
  };
}

function compactFieldErrors(
  value: Record<string, string[] | undefined>,
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length)),
  );
}
