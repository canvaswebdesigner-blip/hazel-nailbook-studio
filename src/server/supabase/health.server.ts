import "@tanstack/react-start/server-only";

import { createPublicSupabaseServerClient } from "@/server/supabase/public-client.server";

export type PublicHealthStatus = {
  status: "ok" | "unavailable";
};

export async function getPublicHealthStatus(): Promise<PublicHealthStatus> {
  try {
    const client = createPublicSupabaseServerClient();
    const { data, error } = await client.rpc("health_check");

    if (error || data !== true) return { status: "unavailable" };
    return { status: "ok" };
  } catch {
    return { status: "unavailable" };
  }
}
