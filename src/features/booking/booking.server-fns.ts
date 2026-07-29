import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getBookingBootstrapServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getBookingBootstrap } = await import("@/server/booking/bootstrap.server");
  return getBookingBootstrap();
});

export const getBookingAvailabilityServerFn = createServerFn({ method: "GET" })
  .validator(z.unknown())
  .handler(async ({ data }) => {
    const { runPublicAvailability } = await import("@/server/booking/availability.server");
    return runPublicAvailability(data);
  });

export const createBookingServerFn = createServerFn({ method: "POST" })
  .validator(z.unknown())
  .handler(async ({ data }) => {
    const { runCreatePublicBooking } = await import("@/server/booking/create-booking.server");
    return runCreatePublicBooking(data);
  });
