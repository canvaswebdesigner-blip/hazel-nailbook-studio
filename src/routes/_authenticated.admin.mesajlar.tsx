import { createFileRoute } from "@tanstack/react-router";

import { AdminMessages } from "@/features/admin/AdminMessages";
import { listAdminContactMessagesServerFn } from "@/features/admin/admin.server-fns";

export const Route = createFileRoute("/_authenticated/admin/mesajlar")({
  loader: () => listAdminContactMessagesServerFn(),
  head: () => ({
    meta: [
      { title: "Mesajlar | Hazel Nail Art Studio" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: AdminMessagesPage,
});

function AdminMessagesPage() {
  const data = Route.useLoaderData();
  return <AdminMessages data={data} />;
}
