import { createFileRoute, redirect } from "@tanstack/react-router";

import { inspectAdminAccessServerFn } from "@/features/admin-auth/admin-auth.server-fns";
import { AdminAuthFrame } from "@/features/admin-auth/AdminAuthFrame";
import { MfaVerificationForm } from "@/features/admin-auth/MfaVerificationForm";

export const Route = createFileRoute("/admin/mfa-dogrula")({
  head: () => ({
    meta: [
      { title: "Güvenlik Kodu | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  loader: async () => {
    const access = await inspectAdminAccessServerFn();
    if (access.status === "needs_mfa_verification") return access;
    if (access.status === "needs_mfa_enrollment") {
      throw redirect({ to: "/admin/mfa" });
    }
    if (access.status === "ready") throw redirect({ to: "/admin" });
    throw redirect({ to: "/admin/giris" });
  },
  component: AdminMfaVerificationPage,
});

function AdminMfaVerificationPage() {
  const access = Route.useLoaderData();
  return (
    <AdminAuthFrame
      title="Güvenlik kodunu gir"
      description="Doğrulama uygulamandaki güncel 6 haneli kodla girişi tamamla."
    >
      <MfaVerificationForm factorId={access.factorId} />
    </AdminAuthFrame>
  );
}
