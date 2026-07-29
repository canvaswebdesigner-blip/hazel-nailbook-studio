import "@tanstack/react-start/server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServiceRoleEnvironment } from "@/server/env.server";

export type ServiceRoleRpcClient = Readonly<{
  rpc: SupabaseClient["rpc"];
}>;

/**
 * Deliberately exposes only `rpc`, not `.from()`.
 *
 * Service-role operations must enter PostgreSQL through reviewed, narrowly
 * scoped functions. Admin authorization must continue to use the request-scoped
 * authenticated client because service role has no end-user `auth.uid()`.
 */
export function createServiceRoleRpcClient(): ServiceRoleRpcClient {
  const environment = getServiceRoleEnvironment();
  const client = createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return Object.freeze({
    rpc: client.rpc.bind(client),
  });
}
