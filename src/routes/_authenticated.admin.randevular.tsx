import { createFileRoute } from "@tanstack/react-router";

import { AdminAppointments } from "@/features/admin/AdminAppointments";
import { listAdminAppointmentsServerFn } from "@/features/admin/admin.server-fns";

export const Route = createFileRoute("/_authenticated/admin/randevular")({
  loader: () => listAdminAppointmentsServerFn(),
  head: () => ({
    meta: [
      { title: "Randevular | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: AdminAppointmentsPage,
});

function AdminAppointmentsPage() {
  const data = Route.useLoaderData();
  return <AdminAppointments data={data} />;
}
