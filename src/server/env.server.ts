import "@tanstack/react-start/server-only";

import type { ZodError, ZodType } from "zod";

import {
  bookingSecretEnvironmentSchema,
  publicSupabaseEnvironmentSchema,
  serviceRoleEnvironmentSchema,
  type BookingSecretEnvironment,
  type PublicSupabaseEnvironment,
  type ServiceRoleEnvironment,
} from "@/config/runtime-env.schema";

export class RuntimeEnvironmentError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`Invalid server runtime configuration: ${fields.join(", ")}`);
    this.name = "RuntimeEnvironmentError";
    this.fields = fields;
  }
}

export function getPublicSupabaseEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): PublicSupabaseEnvironment {
  const value = parseEnvironment(publicSupabaseEnvironmentSchema, source);
  assertRemoteProductionUrl(value.APP_ENV, value.SUPABASE_URL);
  return value;
}

export function getServiceRoleEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ServiceRoleEnvironment {
  const value = parseEnvironment(serviceRoleEnvironmentSchema, source);
  assertRemoteProductionUrl(value.APP_ENV, value.SUPABASE_URL);
  return value;
}

export function getBookingSecretEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): BookingSecretEnvironment {
  return parseEnvironment(bookingSecretEnvironmentSchema, source);
}

function parseEnvironment<T>(schema: ZodType<T>, source: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  throw new RuntimeEnvironmentError(getInvalidFieldNames(result.error));
}

function getInvalidFieldNames(error: ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path[0]).filter(isString))].sort();
}

function isString(value: PropertyKey | undefined): value is string {
  return typeof value === "string";
}

function assertRemoteProductionUrl(appEnvironment: string, supabaseUrl: string): void {
  if (appEnvironment !== "production") return;

  const hostname = new URL(supabaseUrl).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw new RuntimeEnvironmentError(["SUPABASE_URL"]);
  }
}
