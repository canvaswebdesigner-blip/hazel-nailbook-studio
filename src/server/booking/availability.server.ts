import "@tanstack/react-start/server-only";

import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { bookingAvailabilityRequestSchema } from "@/features/booking/booking.schemas";
import type { AvailabilityDay, BookingAvailabilityResult } from "@/features/booking/booking.types";
import { getOrCreatePublicSessionId } from "@/server/security/public-session.server";
import { consumePublicRateLimit } from "@/server/security/rate-limit.server";
import { createServiceRoleRpcClient } from "@/server/supabase/service-role-client.server";

const availabilityRowSchema = z.object({
  end_at: z.string().datetime({ offset: true }),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_at: z.string().datetime({ offset: true }),
});

export async function runPublicAvailability(input: unknown): Promise<BookingAvailabilityResult> {
  setResponseHeader("Cache-Control", "private, no-store, max-age=0");
  setResponseHeader("Vary", "Cookie");

  const parsed = bookingAvailabilityRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      code: "validation_error",
      fieldErrors: compactFieldErrors(parsed.error.flatten().fieldErrors),
      message: "Tarih ve hizmet bilgilerini kontrol et.",
      status: "error",
    };
  }

  try {
    const sessionId = getOrCreatePublicSessionId();
    const rateLimit = await consumePublicRateLimit({
      identity: sessionId,
      limit: 30,
      scope: "availability_session",
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      setResponseHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      return {
        code: "rate_limited",
        message: "Çok sık müsaitlik sorgusu yapıldı. Kısa bir süre sonra tekrar dene.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        status: "error",
      };
    }

    const client = createServiceRoleRpcClient();
    const { data, error } = await client.rpc("get_public_availability", {
      p_end_date: parsed.data.toDate,
      p_service_id: parsed.data.serviceId,
      p_start_date: parsed.data.fromDate,
    });

    if (error) return mapAvailabilityRpcError(error);

    const rows = z.array(availabilityRowSchema).safeParse(data);
    if (!rows.success) return unavailable();

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
    return unavailable();
  }
}

function mapAvailabilityRpcError(error: {
  code?: string;
  message?: string;
}): BookingAvailabilityResult {
  if (error.message === "booking_disabled") {
    return {
      code: "booking_disabled",
      message: "Online randevu şu anda geçici olarak kapalı.",
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

  if (
    error.message === "booking_provider_unavailable" ||
    error.message === "booking_configuration_unavailable"
  ) {
    return unavailable();
  }

  if (error.code === "22023") {
    return {
      code: "validation_error",
      message: "Seçilen tarih aralığı randevu kurallarının dışında.",
      status: "error",
    };
  }

  return unavailable();
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

function compactFieldErrors(
  value: Record<string, string[] | undefined>,
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length)),
  );
}

function unavailable(): BookingAvailabilityResult {
  return {
    code: "unavailable",
    message: "Müsait saatler şu anda yüklenemiyor. Lütfen biraz sonra tekrar dene.",
    status: "error",
  };
}
