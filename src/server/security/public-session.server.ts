import "@tanstack/react-start/server-only";

import { getCookie, setCookie } from "@tanstack/react-start/server";

import { getBookingSecretEnvironment } from "@/server/env.server";
import { generateOpaqueRandomValue } from "@/server/booking/booking-crypto.server";

const secureCookieName = "__Secure-hz_public_session";
const localCookieName = "hz_public_session";
const sessionPattern = /^[A-Za-z0-9_-]{43}$/;
const thirtyDaysInSeconds = 60 * 60 * 24 * 30;

export function getOrCreatePublicSessionId(): string {
  const environment = getBookingSecretEnvironment();
  const isSecureEnvironment =
    environment.APP_ENV === "production" || environment.APP_ENV === "staging";
  const cookieName = isSecureEnvironment ? secureCookieName : localCookieName;
  const existing = getCookie(cookieName);

  if (existing && sessionPattern.test(existing)) return existing;

  const sessionId = generateOpaqueRandomValue(32);
  setCookie(cookieName, sessionId, {
    httpOnly: true,
    maxAge: thirtyDaysInSeconds,
    path: "/",
    sameSite: "lax",
    secure: isSecureEnvironment,
  });
  return sessionId;
}
