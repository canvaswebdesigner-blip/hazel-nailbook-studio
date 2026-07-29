import { createFileRoute } from "@tanstack/react-router";

import { AdminServices } from "@/features/admin/AdminServices";
import { listAdminServicesServerFn } from "@/features/admin/admin.server-fns";

export const Route = createFileRoute("/_authenticated/admin/hizmetler")({
  loader: () => listAdminServicesServerFn(),
  head: () => ({
    meta: [
      { title: "Hizmetler | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: AdminServicesPage,
});

function AdminServicesPage() {
  const services = Route.useLoaderData();
  return <AdminServices services={services} />;
}
