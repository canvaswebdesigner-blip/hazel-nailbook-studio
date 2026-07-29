import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const inspectAdminAccessServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const { inspectAdminAccess } = await import("@/server/auth/admin-auth.server");
  return inspectAdminAccess({ touchSession: true });
});

export const loginAdminServerFn = createServerFn({ method: "POST" })
  .validator(z.unknown())
  .handler(async ({ data }) => {
    const { runAdminLogin } = await import("@/server/auth/admin-auth.server");
    return runAdminLogin(data);
  });

export const startMfaEnrollmentServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const { startMfaEnrollment } = await import("@/server/auth/admin-auth.server");
  return startMfaEnrollment();
});

export const verifyMfaServerFn = createServerFn({ method: "POST" })
  .validator(z.unknown())
  .handler(async ({ data }) => {
    const { runMfaVerification } = await import("@/server/auth/admin-auth.server");
    return runMfaVerification(data);
  });

export const logoutAdminServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const { runAdminLogout } = await import("@/server/auth/admin-auth.server");
  await runAdminLogout();
  return { status: "success" as const };
});

export const forgotAdminPasswordServerFn = createServerFn({ method: "POST" })
  .validator(z.unknown())
  .handler(async ({ data }) => {
    const { runForgotAdminPassword } = await import("@/server/auth/admin-password-recovery.server");
    return runForgotAdminPassword(data);
  });

export const getAdminRecoveryStatusServerFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const { getAdminRecoveryStatus } = await import("@/server/auth/admin-password-recovery.server");
  return getAdminRecoveryStatus();
});

export const resetAdminPasswordServerFn = createServerFn({ method: "POST" })
  .validator(z.unknown())
  .handler(async ({ data }) => {
    const { runResetAdminPassword } = await import("@/server/auth/admin-password-recovery.server");
    return runResetAdminPassword(data);
  });
