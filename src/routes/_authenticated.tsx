import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { inspectAdminAccessServerFn } from "@/features/admin-auth/admin-auth.server-fns";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const access = await inspectAdminAccessServerFn();
    if (access.status === "ready") {
      return { adminAccess: access };
    }
    if (access.status === "needs_mfa_enrollment") {
      throw redirect({ to: "/admin/mfa" });
    }
    if (access.status === "needs_mfa_verification") {
      throw redirect({ to: "/admin/mfa-dogrula" });
    }
    throw redirect({ to: "/admin/giris" });
  },
  component: AuthenticatedOutlet,
});

function AuthenticatedOutlet() {
  return <Outlet />;
}
