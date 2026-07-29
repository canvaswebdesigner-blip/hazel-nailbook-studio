import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAdminRecoveryStatusServerFn } from "@/features/admin-auth/admin-auth.server-fns";
import { AdminAuthFrame } from "@/features/admin-auth/AdminAuthFrame";
import { ResetPasswordForm } from "@/features/admin-auth/ResetPasswordForm";

export const Route = createFileRoute("/admin/sifre-sifirla")({
  head: () => ({
    meta: [
      { title: "Yeni Şifre | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  loader: async () => {
    if (!(await getAdminRecoveryStatusServerFn())) {
      throw redirect({ to: "/admin/giris" });
    }
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <AdminAuthFrame
      title="Yeni şifreni belirle"
      description="Bu kurtarma oturumu tek kullanımlıktır ve 15 dakika içinde sona erer."
    >
      <ResetPasswordForm />
    </AdminAuthFrame>
  );
}
