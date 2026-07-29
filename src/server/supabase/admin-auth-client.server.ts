import "@tanstack/react-start/server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";

import { getPublicSupabaseEnvironment } from "@/server/env.server";

// TanStack Start invokes browser-originated server functions through
// `/_serverFn/*`. A narrower `/admin` path would omit the auth cookie from
// every client-side admin mutation, so the server-owned cookie must cover both
// route documents and the server-function transport.
const adminCookiePath = "/";

export function createAdminAuthServerClient() {
  const environment = getPublicSupabaseEnvironment();
  const isSecure = environment.APP_ENV === "production" || environment.APP_ENV === "staging";
  const cookieName = isSecure ? "__Secure-hz_admin_auth" : "hz_admin_auth";

  return createServerClient(environment.SUPABASE_URL, environment.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
    },
    cookieOptions: {
      httpOnly: true,
      name: cookieName,
      path: adminCookiePath,
      sameSite: "lax",
      secure: isSecure,
    },
    cookies: {
      encode: "tokens-only",
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          setAdminAuthCookie(cookie.name, cookie.value, cookie.options, isSecure);
        }

        for (const [name, value] of Object.entries(headers)) {
          setResponseHeader(name, value);
        }
      },
    },
  });
}

function setAdminAuthCookie(
  name: string,
  value: string,
  options: CookieOptions,
  isSecure: boolean,
): void {
  setCookie(name, value, {
    expires: options.expires,
    httpOnly: true,
    maxAge: options.maxAge,
    path: adminCookiePath,
    sameSite: "lax",
    secure: isSecure,
  });
}
