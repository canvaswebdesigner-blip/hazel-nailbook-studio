import { createFileRoute, redirect } from "@tanstack/react-router";

import { inspectAdminAccessServerFn } from "@/features/admin-auth/admin-auth.server-fns";
import { AdminAuthFrame } from "@/features/admin-auth/AdminAuthFrame";
import { MfaEnrollmentPanel } from "@/features/admin-auth/MfaEnrollmentPanel";

export const Route = createFileRoute("/admin/mfa")({
  head: () => ({
    meta: [
      { title: "İki Adımlı Doğrulama Kurulumu | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  loader: async () => {
    const access = await inspectAdminAccessServerFn();
    if (access.status === "needs_mfa_enrollment") return access;
    if (access.status === "needs_mfa_verification") {
      throw redirect({ to: "/admin/mfa-dogrula" });
    }
    if (access.status === "ready") throw redirect({ to: "/admin" });
    throw redirect({ to: "/admin/giris" });
  },
  component: AdminMfaEnrollmentPage,
});

function AdminMfaEnrollmentPage() {
  return (
    <AdminAuthFrame
      title="İki adımlı doğrulamayı kur"
      description="Yönetim panelini yalnızca şifreyle korumuyoruz. Telefonundaki doğrulama uygulamasını bir kez bağla."
    >
      <MfaEnrollmentPanel />
    </AdminAuthFrame>
  );
}
