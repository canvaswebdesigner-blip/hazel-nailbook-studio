import "@tanstack/react-start/server-only";

import {
  deleteCookie,
  getCookie,
  setCookie,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { z } from "zod";

import {
  appointmentCancellationSubmissionSchema,
  appointmentRescheduleAvailabilityRequestSchema,
  appointmentRescheduleSubmissionSchema,
} from "@/features/booking/booking.schemas";
import type {
  AppointmentAccessResult,
  AppointmentAccessScope,
  AppointmentAccessView,
  AppointmentManageFailure,
  AppointmentMutationResult,
  AppointmentRescheduleAvailabilityResult,
  AvailabilityDay,
  BookingPriceType,
} from "@/features/booking/booking.types";
import {
  derivePrivateHmacHex,
  generateOpaqueRandomValue,
  sha256Hex,
} from "@/server/booking/booking-crypto.server";
import { getBookingSecretEnvironment } from "@/server/env.server";
import { consumePublicRateLimit } from "@/server/security/rate-limit.server";
import { createServiceRoleRpcClient } from "@/server/supabase/service-role-client.server";

const rawTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const sessionPattern = /^[A-Za-z0-9_-]{43}$/;
const appointmentStatusSchema = z.enum(["confirmed", "completed", "cancelled", "no_show"]);
const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  });
const exchangeRowSchema = z.object({
  absolute_expires_at: z.string().datetime({ offset: true }),
  access_scope: z.enum(["receipt_read", "appointment_manage"]),
  appointment_id: z.string().uuid(),
  sliding_expires_at: z.string().datetime({ offset: true }),
});
const availabilityRowSchema = z.object({
  end_at: z.string().datetime({ offset: true }),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_at: z.string().datetime({ offset: true }),
});
const appointmentAccessRowSchema = z.object({
  access_scope: z.enum(["receipt_read", "appointment_manage"]),
  address: z.string().max(1000).nullable(),
  appointment_id: z.string().uuid(),
  appointment_status: appointmentStatusSchema,
  booking_code: z.string().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8,16}$/),
  business_name: z.string().min(2).max(120),
  can_cancel: z.boolean(),
  can_reschedule: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  duration_minutes: z.number().int().min(15).max(720),
  end_at: z.string().datetime({ offset: true }),
  map_url: httpUrlSchema.nullable(),
  maximum_booking_days: z.number().int().min(1).max(60),
  phone_e164: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/)
    .nullable(),
  price_type: z.enum(["fixed", "starting_from", "quote_required"]),
  quoted_price: z
    .union([z.number(), z.string()])
    .nullable()
    .transform((value) => (value === null ? null : String(value))),
  row_version: z
    .union([z.number(), z.string()])
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
  service_id: z.string().uuid(),
  service_name: z.string().min(2).max(120),
  session_absolute_expires_at: z.string().datetime({ offset: true }),
  session_expires_at: z.string().datetime({ offset: true }),
  start_at: z.string().datetime({ offset: true }),
  whatsapp_e164: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/)
    .nullable(),
});
const appointmentMutationRowSchema = z.object({
  appointment_end_at: z.string().datetime({ offset: true }),
  appointment_start_at: z.string().datetime({ offset: true }),
  appointment_status: appointmentStatusSchema,
  can_cancel: z.boolean(),
  can_reschedule: z.boolean(),
  cancelled_at: z.string().datetime({ offset: true }).nullable().optional(),
  result_row_version: z
    .union([z.number(), z.string()])
    .transform(Number)
    .pipe(z.number().int().nonnegative()),
});

const receiptTargetPath = "/randevu-basarili";
const managementTargetPath = "/randevu-yonet";
const sessionLifetimeSeconds = 30 * 60;

export async function exchangeAppointmentAccessToken(input: {
  rawToken: string;
  requestUrl: string;
  scope: AppointmentAccessScope;
}): Promise<Response> {
  const targetPath = getTargetPath(input.scope);

  try {
    if (!rawTokenPattern.test(input.rawToken)) {
      clearAllAppointmentAccessCookies(input.scope);
      return exchangeRedirect(input.requestUrl, targetPath, false);
    }

    const tokenHash = await sha256Hex(input.rawToken);
    const rateLimit = await consumePublicRateLimit({
      identity: tokenHash,
      limit: 20,
      scope: `appointment_token_exchange_${input.scope}`,
      windowSeconds: 15 * 60,
    });

    if (!rateLimit.allowed) {
      clearAllAppointmentAccessCookies(input.scope);
      return exchangeRedirect(input.requestUrl, targetPath, false, rateLimit.retryAfterSeconds);
    }

    const sessionId = generateOpaqueRandomValue(32);
    const sessionHash = await sha256Hex(sessionId);
    const client = createServiceRoleRpcClient();
    const { data, error } = await client.rpc("exchange_appointment_access_token", {
      p_request_id: crypto.randomUUID(),
      p_scope: input.scope,
      p_session_hash: sessionHash,
      p_token_hash: tokenHash,
    });
    if (error) {
      clearAllAppointmentAccessCookies(input.scope);
      return exchangeRedirect(input.requestUrl, targetPath, false);
    }

    const exchange = z.array(exchangeRowSchema).safeParse(data);
    if (
      !exchange.success ||
      exchange.data.length !== 1 ||
      exchange.data[0].access_scope !== input.scope
    ) {
      clearAllAppointmentAccessCookies(input.scope);
      return exchangeRedirect(input.requestUrl, targetPath, false);
    }

    setAppointmentAccessCookie(input.scope, sessionId);
    return exchangeRedirect(input.requestUrl, targetPath, true);
  } catch {
    clearAllAppointmentAccessCookies(input.scope);
    return exchangeRedirect(input.requestUrl, targetPath, false);
  }
}

export async function readAppointmentAccessSession(
  scope: AppointmentAccessScope,
): Promise<AppointmentAccessResult> {
  setAppointmentResponseHeaders();

  try {
    const sessionId = getAppointmentAccessSessionId(scope);
    if (!sessionId) return invalid();

    const client = createServiceRoleRpcClient();
    const { data, error } = await client.rpc("get_appointment_access_session", {
      p_required_scope: scope,
      p_session_hash: await sha256Hex(sessionId),
    });
    if (error) {
      clearAllAppointmentAccessCookies(scope);
      return invalid();
    }

    const rows = z.array(appointmentAccessRowSchema).safeParse(data);
    if (!rows.success || rows.data.length !== 1 || rows.data[0].access_scope !== scope) {
      clearAllAppointmentAccessCookies(scope);
      return invalid();
    }

    setAppointmentAccessCookie(scope, sessionId);
    return {
      appointment: normalizeAppointmentAccessView(rows.data[0]),
      status: "ready",
    };
  } catch {
    return {
      message: "Randevu bilgileri şu anda görüntülenemiyor. Lütfen biraz sonra tekrar dene.",
      status: "unavailable",
    };
  }
}

export async function runAppointmentRescheduleAvailability(
  input: unknown,
): Promise<AppointmentRescheduleAvailabilityResult> {
  setAppointmentResponseHeaders();

  const parsed = appointmentRescheduleAvailabilityRequestSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(compactFieldErrors(parsed.error.flatten().fieldErrors));
  }

  const sessionId = getAppointmentAccessSessionId("appointment_manage");
  if (!sessionId) return invalidSessionFailure();

  try {
    const rateLimit = await consumePublicRateLimit({
      identity: sessionId,
      limit: 30,
      scope: "appointment_reschedule_availability",
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      setResponseHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return rateLimited(rateLimit.retryAfterSeconds);
    }

    const client = createServiceRoleRpcClient();
    const { data, error } = await client.rpc("get_customer_reschedule_availability", {
      p_end_date: parsed.data.toDate,
      p_session_hash: await sha256Hex(sessionId),
      p_start_date: parsed.data.fromDate,
    });
    if (error) return mapAppointmentManageRpcError(error, "availability");

    const rows = z.array(availabilityRowSchema).safeParse(data);
    if (!rows.success) return unavailableManageFailure();

    setAppointmentAccessCookie("appointment_manage", sessionId);
    const days = buildAvailabilityDays(parsed.data.fromDate, parsed.data.toDate, rows.data);
    return {
      availability: {
        days,
        nextAvailableDate: days.find((day) => day.slots.length > 0)?.localDate ?? null,
        timezone: "Europe/Istanbul",
      },
      status: "success",
    };
  } catch {
    return unavailableManageFailure();
  }
}

export async function runRescheduleAppointment(input: unknown): Promise<AppointmentMutationResult> {
  setAppointmentResponseHeaders();

  const parsed = appointmentRescheduleSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(compactFieldErrors(parsed.error.flatten().fieldErrors));
  }

  const sessionId = getAppointmentAccessSessionId("appointment_manage");
  if (!sessionId) return invalidSessionFailure();

  try {
    const rateLimit = await consumePublicRateLimit({
      identity: sessionId,
      limit: 10,
      scope: "appointment_reschedule",
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      setResponseHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return rateLimited(rateLimit.retryAfterSeconds);
    }

    const sessionHash = await sha256Hex(sessionId);
    const idempotencyKeyHmac = await derivePrivateHmacHex(
      "idempotency:customer_reschedule:v1",
      `${sessionHash}|${parsed.data.idempotencyKey}`,
    );
    const requestFingerprint = await derivePrivateHmacHex(
      "fingerprint:customer_reschedule:v1",
      JSON.stringify([
        "customer_reschedule:v1",
        sessionHash,
        parsed.data.startAt,
        parsed.data.expectedRowVersion,
      ]),
    );

    const client = createServiceRoleRpcClient();
    const { data, error } = await client.rpc("reschedule_customer_appointment", {
      p_expected_row_version: parsed.data.expectedRowVersion,
      p_idempotency_key_hmac: idempotencyKeyHmac,
      p_new_start_at: parsed.data.startAt,
      p_request_fingerprint: requestFingerprint,
      p_request_id: crypto.randomUUID(),
      p_session_hash: sessionHash,
    });
    if (error) return mapAppointmentManageRpcError(error, "reschedule");

    const rows = z.array(appointmentMutationRowSchema).safeParse(data);
    if (!rows.success || rows.data.length !== 1) return unavailableManageFailure();

    setAppointmentAccessCookie("appointment_manage", sessionId);
    return normalizeAppointmentMutation(rows.data[0]);
  } catch {
    return unavailableManageFailure();
  }
}

export async function runCancelAppointment(input: unknown): Promise<AppointmentMutationResult> {
  setAppointmentResponseHeaders();

  const parsed = appointmentCancellationSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(compactFieldErrors(parsed.error.flatten().fieldErrors));
  }

  const sessionId = getAppointmentAccessSessionId("appointment_manage");
  if (!sessionId) return invalidSessionFailure();

  try {
    const rateLimit = await consumePublicRateLimit({
      identity: sessionId,
      limit: 5,
      scope: "appointment_cancellation",
      windowSeconds: 15 * 60,
    });
    if (!rateLimit.allowed) {
      setResponseHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return rateLimited(rateLimit.retryAfterSeconds);
    }

    const sessionHash = await sha256Hex(sessionId);
    const normalizedReason = parsed.data.reason.trim();
    const idempotencyKeyHmac = await derivePrivateHmacHex(
      "idempotency:customer_cancellation:v1",
      `${sessionHash}|${parsed.data.idempotencyKey}`,
    );
    const requestFingerprint = await derivePrivateHmacHex(
      "fingerprint:customer_cancellation:v1",
      JSON.stringify([
        "customer_cancellation:v1",
        sessionHash,
        parsed.data.expectedRowVersion,
        normalizedReason || null,
      ]),
    );

    const client = createServiceRoleRpcClient();
    const { data, error } = await client.rpc("cancel_customer_appointment", {
      p_cancellation_reason: normalizedReason,
      p_expected_row_version: parsed.data.expectedRowVersion,
      p_idempotency_key_hmac: idempotencyKeyHmac,
      p_request_fingerprint: requestFingerprint,
      p_request_id: crypto.randomUUID(),
      p_session_hash: sessionHash,
    });
    if (error) return mapAppointmentManageRpcError(error, "cancel");

    const rows = z.array(appointmentMutationRowSchema).safeParse(data);
    if (!rows.success || rows.data.length !== 1) return unavailableManageFailure();

    clearAllAppointmentAccessCookies("appointment_manage");
    return normalizeAppointmentMutation(rows.data[0]);
  } catch {
    return unavailableManageFailure();
  }
}

function normalizeAppointmentAccessView(
  row: z.infer<typeof appointmentAccessRowSchema>,
): AppointmentAccessView {
  return {
    accessScope: row.access_scope,
    address: row.address,
    appointmentStatus: row.appointment_status,
    bookingCode: row.booking_code,
    businessName: row.business_name,
    canCancel: row.can_cancel,
    canReschedule: row.can_reschedule,
    currency: row.currency,
    durationMinutes: row.duration_minutes,
    endAt: row.end_at,
    mapUrl: row.map_url,
    maximumBookingDays: row.maximum_booking_days,
    phone: row.phone_e164,
    priceType: row.price_type as BookingPriceType,
    quotedPrice: row.quoted_price,
    rowVersion: row.row_version,
    serviceId: row.service_id,
    serviceName: row.service_name,
    sessionAbsoluteExpiresAt: row.session_absolute_expires_at,
    sessionExpiresAt: row.session_expires_at,
    startAt: row.start_at,
    timezone: "Europe/Istanbul",
    whatsapp: row.whatsapp_e164,
  };
}

function normalizeAppointmentMutation(
  row: z.infer<typeof appointmentMutationRowSchema>,
): AppointmentMutationResult {
  return {
    appointmentStatus: row.appointment_status,
    canCancel: row.can_cancel,
    canReschedule: row.can_reschedule,
    cancelledAt: row.cancelled_at ?? undefined,
    endAt: row.appointment_end_at,
    rowVersion: row.result_row_version,
    startAt: row.appointment_start_at,
    status: "success",
  };
}

function getAppointmentAccessSessionId(scope: AppointmentAccessScope): string | null {
  const cookieName = getCookieConfiguration(scope).name;
  const sessionId = getCookie(cookieName);
  if (sessionId && sessionPattern.test(sessionId)) return sessionId;

  clearAllAppointmentAccessCookies(scope);
  return null;
}

function getCookieConfiguration(scope: AppointmentAccessScope): {
  isSecure: boolean;
  name: string;
  path: string;
} {
  const environment = getBookingSecretEnvironment();
  const isSecure = environment.APP_ENV === "production" || environment.APP_ENV === "staging";
  const baseName = scope === "receipt_read" ? "hz_appt_receipt" : "hz_appt_manage";

  return {
    isSecure,
    name: isSecure ? `__Secure-${baseName}` : baseName,
    // Appointment reads and mutations are transported through TanStack
    // Start's `/_serverFn/*` endpoint. Restricting the cookie to the rendered
    // appointment route would make those server functions unauthenticated.
    path: "/",
  };
}

function setAppointmentAccessCookie(scope: AppointmentAccessScope, sessionId: string): void {
  const cookie = getCookieConfiguration(scope);
  setCookie(cookie.name, sessionId, {
    httpOnly: true,
    maxAge: sessionLifetimeSeconds,
    path: cookie.path,
    sameSite: "lax",
    secure: cookie.isSecure,
  });
}

function clearAllAppointmentAccessCookies(scope: AppointmentAccessScope): void {
  const path = "/";
  const baseName = scope === "receipt_read" ? "hz_appt_receipt" : "hz_appt_manage";

  for (const cookie of [
    { name: baseName, secure: false },
    { name: `__Secure-${baseName}`, secure: true },
  ]) {
    try {
      deleteCookie(cookie.name, {
        path,
        secure: cookie.secure,
      });
    } catch {
      // Token exchange must still redirect away from the credential-bearing URL.
    }
  }
}

function getTargetPath(scope: AppointmentAccessScope): string {
  return scope === "receipt_read" ? receiptTargetPath : managementTargetPath;
}

function exchangeRedirect(
  requestUrl: string,
  targetPath: string,
  successful: boolean,
  retryAfterSeconds?: number,
): Response {
  const location = new URL(targetPath, requestUrl);
  if (!successful) location.searchParams.set("durum", "gecersiz");

  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    Location: location.toString(),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
  });
  if (retryAfterSeconds) headers.set("Retry-After", String(retryAfterSeconds));

  return new Response(null, { headers, status: 303 });
}

function invalid(): AppointmentAccessResult {
  return {
    message:
      "Bu özel randevu bağlantısı geçersiz, süresi dolmuş veya daha önce yenilenmiş olabilir.",
    status: "invalid",
  };
}

function buildAvailabilityDays(
  fromDate: string,
  toDate: string,
  rows: readonly z.infer<typeof availabilityRowSchema>[],
): AvailabilityDay[] {
  const slotsByDate = new Map<string, Array<{ endAt: string; startAt: string }>>();
  for (const row of rows) {
    const slots = slotsByDate.get(row.local_date) ?? [];
    slots.push({ endAt: row.end_at, startAt: row.start_at });
    slotsByDate.set(row.local_date, slots);
  }

  return enumerateIsoDates(fromDate, toDate).map((localDate) => ({
    localDate,
    slots: slotsByDate.get(localDate) ?? [],
  }));
}

function enumerateIsoDates(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  let cursor = isoDateToUtcDate(fromDate);
  const end = isoDateToUtcDate(toDate);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return dates;
}

function isoDateToUtcDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function mapAppointmentManageRpcError(
  error: Readonly<{ code?: string; message?: string }>,
  operation: "availability" | "cancel" | "reschedule",
): AppointmentManageFailure {
  if (error.message === "appointment_session_invalid") {
    clearAllAppointmentAccessCookies("appointment_manage");
    return invalidSessionFailure();
  }

  if (
    error.message === "cancellation_deadline_passed" ||
    error.message === "reschedule_deadline_passed"
  ) {
    return {
      code: "deadline_passed",
      message:
        operation === "cancel"
          ? "Online iptal süresi dolmuş. Hazel ile doğrudan iletişime geçebilirsin."
          : "Online tarih değiştirme süresi dolmuş. Hazel ile doğrudan iletişime geçebilirsin.",
      status: "error",
    };
  }

  if (error.message === "stale_appointment" || error.code === "40001") {
    return {
      code: "stale",
      message: "Randevu başka bir işlem sırasında güncellendi. Sayfayı yenileyip tekrar dene.",
      status: "error",
    };
  }

  if (error.message === "idempotency_key_reuse") {
    return {
      code: "idempotency_key_reuse",
      message: "İşlem bilgileri değişti. Lütfen yeniden onayla.",
      status: "error",
    };
  }

  if (error.message === "slot_unavailable" || error.code === "23P01") {
    return {
      code: "slot_conflict",
      message: "Bu saat az önce dolmuş görünüyor. Başka bir müsait saat seç.",
      status: "error",
    };
  }

  if (
    error.message === "appointment_time_unchanged" ||
    error.message === "reschedule_date_outside_policy" ||
    error.code === "22023"
  ) {
    return validationFailure();
  }

  return unavailableManageFailure();
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
): AppointmentManageFailure {
  return {
    code: "validation_error",
    fieldErrors,
    message: "İşlem bilgilerini kontrol et.",
    status: "error",
  };
}

function invalidSessionFailure(): AppointmentManageFailure {
  return {
    code: "invalid_session",
    message: "Özel randevu oturumunun süresi dolmuş. Yönetim bağlantını yeniden aç.",
    status: "error",
  };
}

function rateLimited(retryAfterSeconds: number): AppointmentManageFailure {
  return {
    code: "rate_limited",
    message: "Çok sık işlem denendi. Kısa bir süre sonra tekrar dene.",
    retryAfterSeconds,
    status: "error",
  };
}

function unavailableManageFailure(): AppointmentManageFailure {
  return {
    code: "unavailable",
    message: "Randevu işlemi şu anda tamamlanamıyor. Lütfen biraz sonra tekrar dene.",
    status: "error",
  };
}

function setAppointmentResponseHeaders(): void {
  setResponseHeader("Cache-Control", "private, no-store, max-age=0");
  setResponseHeader("Referrer-Policy", "no-referrer");
  setResponseHeader("X-Robots-Tag", "noindex, nofollow");
  setResponseHeader("Vary", "Cookie");
}
