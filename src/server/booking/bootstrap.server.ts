import "@tanstack/react-start/server-only";

import { z } from "zod";

import type {
  BookableService,
  BookingBootstrap,
  BookingPolicy,
  BookingPriceType,
} from "@/features/booking/booking.types";
import { createPublicSupabaseServerClient } from "@/server/supabase/public-client.server";

const priceTypeSchema = z.enum(["fixed", "starting_from", "quote_required"]);
const siteSettingsRowSchema = z.object({
  booking_disabled: z.boolean(),
  maximum_booking_days: z.number().int().min(1).max(365),
  minimum_notice_minutes: z.number().int().min(0).max(10_080),
  slot_granularity_minutes: z
    .number()
    .int()
    .refine((value) => [5, 10, 15, 20, 30, 60].includes(value)),
  timezone: z.literal("Europe/Istanbul"),
});
const serviceRowSchema = z.object({
  category: z.string().min(2).max(80),
  currency: z.string().regex(/^[A-Z]{3}$/),
  duration_minutes: z.number().int().min(15).max(720),
  id: z.string().uuid(),
  is_bookable: z.boolean(),
  name: z.string().min(2).max(120),
  price: z
    .union([z.number(), z.string()])
    .nullable()
    .transform((value) => (value === null ? null : String(value))),
  price_type: priceTypeSchema,
  short_description: z.string().min(10).max(240),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const policyRowSchema = z.object({
  content: z.string().min(50).max(50_000),
  policy_type: z.enum(["privacy_notice", "booking_terms", "terms_of_use", "cookie_notice"]),
  published_at: z.string().datetime({ offset: true }),
  version: z.string().min(1).max(50),
});

export async function getBookingBootstrap(): Promise<BookingBootstrap> {
  try {
    const client = createPublicSupabaseServerClient();
    const [settingsResult, servicesResult, policiesResult] = await Promise.all([
      client.rpc("get_public_site_settings"),
      client.rpc("get_public_services"),
      client.rpc("get_current_policy_documents"),
    ]);

    if (settingsResult.error || servicesResult.error || policiesResult.error) {
      return unavailable();
    }

    const settings = z.array(siteSettingsRowSchema).safeParse(settingsResult.data);
    const services = z.array(serviceRowSchema).safeParse(servicesResult.data);
    const policies = z.array(policyRowSchema).safeParse(policiesResult.data);
    if (!settings.success || settings.data.length !== 1 || !services.success || !policies.success) {
      return unavailable();
    }

    const bookableServices = services.data
      .filter((service) => service.is_bookable)
      .map(normalizeService);
    const privacyNotice = normalizePolicy(
      policies.data.find((policy) => policy.policy_type === "privacy_notice"),
    );
    const bookingTerms = normalizePolicy(
      policies.data.find((policy) => policy.policy_type === "booking_terms"),
    );

    if (!bookableServices.length || !privacyNotice || !bookingTerms) {
      return {
        message: "Online randevu için gerekli işletme bilgileri henüz tamamlanmadı.",
        status: "not_configured",
      };
    }

    const siteSettings = settings.data[0];
    if (siteSettings.booking_disabled) {
      return {
        message: "Online randevu şu anda geçici olarak kapalı. Lütfen daha sonra tekrar dene.",
        status: "temporarily_disabled",
      };
    }

    return {
      bookingDisabled: false,
      maximumBookingDays: Math.min(siteSettings.maximum_booking_days, 60),
      minimumNoticeMinutes: siteSettings.minimum_notice_minutes,
      policies: { bookingTerms, privacyNotice },
      services: bookableServices,
      slotGranularityMinutes: siteSettings.slot_granularity_minutes,
      status: "ready",
      timezone: siteSettings.timezone,
    };
  } catch {
    return unavailable();
  }
}

function normalizeService(row: z.infer<typeof serviceRowSchema>): BookableService {
  return {
    category: row.category,
    currency: row.currency,
    durationMinutes: row.duration_minutes,
    id: row.id,
    name: row.name,
    price: row.price,
    priceType: row.price_type as BookingPriceType,
    shortDescription: row.short_description,
    slug: row.slug,
  };
}

function normalizePolicy(row: z.infer<typeof policyRowSchema> | undefined): BookingPolicy | null {
  if (!row || (row.policy_type !== "privacy_notice" && row.policy_type !== "booking_terms")) {
    return null;
  }

  return {
    content: row.content,
    publishedAt: row.published_at,
    type: row.policy_type,
    version: row.version,
  };
}

function unavailable(): BookingBootstrap {
  return {
    message: "Randevu bilgileri şu anda yüklenemiyor. Lütfen biraz sonra tekrar dene.",
    status: "unavailable",
  };
}
