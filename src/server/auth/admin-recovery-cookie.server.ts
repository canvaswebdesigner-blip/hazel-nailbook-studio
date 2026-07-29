import "@tanstack/react-start/server-only";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { getPublicSupabaseEnvironment } from "@/server/env.server";

const opaqueValuePattern = /^[A-Za-z0-9_-]{43}$/;
const statePath = "/admin/auth/callback";
const recoveryPath = "/";

export function setAdminRecoveryStateCookie(value: string): void {
  setRecoveryCookie("recovery_state", value, statePath, 15 * 60);
}

export function getAdminRecoveryStateCookie(): string | null {
  return getRecoveryCookie("recovery_state");
}

export function clearAdminRecoveryStateCookie(): void {
  clearRecoveryCookie("recovery_state", statePath);
}

export function setAdminRecoverySessionCookie(value: string): void {
  setRecoveryCookie("recovery_session", value, recoveryPath, 15 * 60);
}

export function getAdminRecoverySessionCookie(): string | null {
  return getRecoveryCookie("recovery_session");
}

export function clearAdminRecoverySessionCookie(): void {
  clearRecoveryCookie("recovery_session", recoveryPath);
}

function setRecoveryCookie(
  suffix: "recovery_session" | "recovery_state",
  value: string,
  path: string,
  maxAge: number,
): void {
  const { isSecure, name } = getCookieConfiguration(suffix);
  setCookie(name, value, {
    httpOnly: true,
    maxAge,
    path,
    sameSite: "lax",
    secure: isSecure,
  });
}

function getRecoveryCookie(suffix: "recovery_session" | "recovery_state"): string | null {
  const value = getCookie(getCookieConfiguration(suffix).name);
  return value && opaqueValuePattern.test(value) ? value : null;
}

function clearRecoveryCookie(suffix: "recovery_session" | "recovery_state", path: string): void {
  const baseName = `hz_admin_${suffix}`;
  for (const cookie of [
    { name: baseName, secure: false },
    { name: `__Secure-${baseName}`, secure: true },
  ]) {
    deleteCookie(cookie.name, { path, secure: cookie.secure });
  }
}

function getCookieConfiguration(suffix: "recovery_session" | "recovery_state"): {
  isSecure: boolean;
  name: string;
} {
  const environment = getPublicSupabaseEnvironment();
  const isSecure = environment.APP_ENV === "production" || environment.APP_ENV === "staging";
  const baseName = `hz_admin_${suffix}`;
  return {
    isSecure,
    name: isSecure ? `__Secure-${baseName}` : baseName,
  };
}
