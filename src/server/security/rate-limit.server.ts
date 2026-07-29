import "@tanstack/react-start/server-only";

import { z } from "zod";

import { derivePrivateHmacHex } from "@/server/booking/booking-crypto.server";
import { createServiceRoleRpcClient } from "@/server/supabase/service-role-client.server";

const rateLimitRowSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number().int().min(0),
  retry_after_seconds: z.number().int().min(0),
});

type PublicRateLimitScope =
  | "appointment_cancellation"
  | "appointment_reschedule"
  | "appointment_reschedule_availability"
  | "appointment_token_exchange_appointment_manage"
  | "appointment_token_exchange_receipt_read"
  | "availability_session"
  | "admin_login_email"
  | "admin_login_session"
  | "admin_mfa_verify"
  | "admin_password_recovery_email"
  | "admin_password_recovery_session"
  | "booking_phone"
  | "booking_session"
  | "contact_identity"
  | "contact_session";

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}>;

export async function consumePublicRateLimit(input: {
  identity: string;
  limit: number;
  scope: PublicRateLimitScope;
  windowSeconds: number;
}): Promise<RateLimitDecision> {
  const bucketHmac = await derivePrivateHmacHex(`rate:${input.scope}:v1`, input.identity);
  const client = createServiceRoleRpcClient();
  const { data, error } = await client.rpc("consume_public_rate_limit", {
    p_bucket_hmac: bucketHmac,
    p_request_limit: input.limit,
    p_scope: input.scope,
    p_window_seconds: input.windowSeconds,
  });

  if (error) throw new Error("Public rate-limit RPC failed");

  const result = z.array(rateLimitRowSchema).safeParse(data);
  if (!result.success || result.data.length !== 1) {
    throw new Error("Public rate-limit RPC returned an invalid result");
  }

  const row = result.data[0];
  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}
