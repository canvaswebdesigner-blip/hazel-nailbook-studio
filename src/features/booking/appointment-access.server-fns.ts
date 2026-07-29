import { createServerFn } from "@tanstack/react-start";

export const getReceiptAppointmentServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readAppointmentAccessSession } =
    await import("@/server/booking/appointment-access.server");
  return readAppointmentAccessSession("receipt_read");
});

export const getManageAppointmentServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { readAppointmentAccessSession } =
    await import("@/server/booking/appointment-access.server");
  return readAppointmentAccessSession("appointment_manage");
});

export const getAppointmentRescheduleAvailabilityServerFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { runAppointmentRescheduleAvailability } =
      await import("@/server/booking/appointment-access.server");
    return runAppointmentRescheduleAvailability(data);
  });

export const rescheduleAppointmentServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { runRescheduleAppointment } = await import("@/server/booking/appointment-access.server");
    return runRescheduleAppointment(data);
  });

export const cancelAppointmentServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const { runCancelAppointment } = await import("@/server/booking/appointment-access.server");
    return runCancelAppointment(data);
  });
