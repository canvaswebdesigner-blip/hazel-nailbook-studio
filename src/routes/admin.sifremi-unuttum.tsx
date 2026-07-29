import { createFileRoute } from "@tanstack/react-router";

import { AdminAuthFrame } from "@/features/admin-auth/AdminAuthFrame";
import { ForgotPasswordForm } from "@/features/admin-auth/ForgotPasswordForm";

export const Route = createFileRoute("/admin/sifremi-unuttum")({
  head: () => ({
    meta: [
      { title: "Şifre Kurtarma | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <AdminAuthFrame
      title="Şifreni yenile"
      description="Yönetici e-posta adresini yaz. Hesap doğrulanırsa kısa ömürlü bir kurtarma bağlantısı gönderilecek."
    >
      <ForgotPasswordForm />
    </AdminAuthFrame>
  );
}
