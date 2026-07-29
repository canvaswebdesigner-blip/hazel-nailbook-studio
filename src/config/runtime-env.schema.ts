import { z } from "zod";

export const appEnvironmentSchema = z.enum(["local", "staging", "production", "test"]);

const baseRuntimeFields = {
  APP_ENV: appEnvironmentSchema,
  SITE_URL: z.string().url(),
} as const;

export const publicSupabaseEnvironmentSchema = z.object({
  ...baseRuntimeFields,
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export const serviceRoleEnvironmentSchema = publicSupabaseEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export const bookingSecretEnvironmentSchema = z.object({
  ...baseRuntimeFields,
  BOOKING_TOKEN_HMAC_KEYS: z.string().min(1),
  BOOKING_TOKEN_ACTIVE_KEY_VERSION: z.coerce.number().int().positive(),
  RATE_LIMIT_HMAC_SECRET: z.string().min(32),
});

export type PublicSupabaseEnvironment = z.infer<typeof publicSupabaseEnvironmentSchema>;
export type ServiceRoleEnvironment = z.infer<typeof serviceRoleEnvironmentSchema>;
export type BookingSecretEnvironment = z.infer<typeof bookingSecretEnvironmentSchema>;
