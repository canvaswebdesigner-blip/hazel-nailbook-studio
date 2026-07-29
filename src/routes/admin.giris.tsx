import { createFileRoute } from "@tanstack/react-router";

import { AdminAuthFrame } from "@/features/admin-auth/AdminAuthFrame";
import { AdminLoginForm } from "@/features/admin-auth/AdminLoginForm";

export const Route = createFileRoute("/admin/giris")({
  head: () => ({
    meta: [
      { title: "Yönetici Girişi | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  return (
    <AdminAuthFrame
      title="Yönetici girişi"
      description="Randevulara ve işletme ayarlarına erişmek için güvenli oturum aç."
    >
      <AdminLoginForm />
    </AdminAuthFrame>
  );
}
