import { createFileRoute } from "@tanstack/react-router";

import { exchangeAppointmentAccessToken } from "@/server/booking/appointment-access.server";

export const Route = createFileRoute("/randevu-yonet/$managementToken")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        exchangeAppointmentAccessToken({
          rawToken: params.managementToken,
          requestUrl: request.url,
          scope: "appointment_manage",
        }),
    },
  },
});
