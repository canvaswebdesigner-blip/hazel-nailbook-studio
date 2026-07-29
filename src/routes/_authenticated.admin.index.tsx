import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { getAdminDashboardServerFn } from "@/features/admin/admin.server-fns";

const authenticatedRoute = getRouteApi("/_authenticated");

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: () => getAdminDashboardServerFn(),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { adminAccess } = authenticatedRoute.useRouteContext();
  const dashboard = Route.useLoaderData();
  return <AdminDashboard data={dashboard} identity={adminAccess.identity} />;
}
