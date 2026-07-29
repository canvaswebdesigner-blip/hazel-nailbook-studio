import { createFileRoute } from "@tanstack/react-router";

import { AppointmentAccessPanel } from "@/features/booking/AppointmentAccessPanel";
import { getManageAppointmentServerFn } from "@/features/booking/appointment-access.server-fns";

const title = "Randevunu Yönet | Hazel Ağaoğlu Nail Art Studio";

export const Route = createFileRoute("/randevu-yonet")({
  head: () => ({
    meta: [
      { title },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  loader: () => getManageAppointmentServerFn(),
  component: ManageAppointmentPage,
});

function ManageAppointmentPage() {
  const result = Route.useLoaderData();
  return <AppointmentAccessPanel mode="manage" result={result} />;
}
