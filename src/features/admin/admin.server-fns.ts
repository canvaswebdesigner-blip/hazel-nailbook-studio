import { createServerFn } from "@tanstack/react-start";

export const getAdminDashboardServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminDashboard } = await import("@/server/admin/admin-data.server");
  return getAdminDashboard();
});

export const listAdminAppointmentsServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  const { listAdminAppointments } = await import("@/server/admin/admin-data.server");
  return listAdminAppointments();
});

export const listAdminServicesServerFn = createServerFn({ method: "POST" }).handler(async () => {
  const { listAdminServices } = await import("@/server/admin/admin-data.server");
  return listAdminServices();
});

export const upsertAdminServiceServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { upsertAdminService } = await import("@/server/admin/admin-data.server");
    return upsertAdminService(data);
  });

export const listAdminContactMessagesServerFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { listAdminContactMessages } = await import("@/server/admin/admin-data.server");
    return listAdminContactMessages();
  },
);

export const updateAdminContactStatusServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { updateAdminContactStatus } = await import("@/server/admin/admin-data.server");
    return updateAdminContactStatus(data);
  });
