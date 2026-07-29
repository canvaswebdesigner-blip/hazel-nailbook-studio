import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AdminShell } from "@/features/admin/AdminShell";

const authenticatedRoute = getRouteApi("/_authenticated");

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Yönetim Paneli | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { adminAccess } = authenticatedRoute.useRouteContext();
  return <AdminShell identity={adminAccess.identity} />;
}
