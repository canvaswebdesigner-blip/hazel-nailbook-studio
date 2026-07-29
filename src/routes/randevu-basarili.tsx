import { createFileRoute } from "@tanstack/react-router";

import { AppointmentAccessPanel } from "@/features/booking/AppointmentAccessPanel";
import { getReceiptAppointmentServerFn } from "@/features/booking/appointment-access.server-fns";

const title = "Randevu Bilgileri | Hazel Ağaoğlu Nail Art Studio";

export const Route = createFileRoute("/randevu-basarili")({
  head: () => ({
    meta: [
      { title },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  loader: () => getReceiptAppointmentServerFn(),
  component: ReceiptAppointmentPage,
});

function ReceiptAppointmentPage() {
  const result = Route.useLoaderData();
  return <AppointmentAccessPanel mode="receipt" result={result} />;
}
