import "@tanstack/react-start/server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnvironment } from "@/server/env.server";

export function createPublicSupabaseServerClient() {
  const environment = getPublicSupabaseEnvironment();

  return createClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
