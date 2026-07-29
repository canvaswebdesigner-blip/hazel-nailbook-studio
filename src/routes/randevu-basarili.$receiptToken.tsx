import { createFileRoute } from "@tanstack/react-router";

import { exchangeAppointmentAccessToken } from "@/server/booking/appointment-access.server";

export const Route = createFileRoute("/randevu-basarili/$receiptToken")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        exchangeAppointmentAccessToken({
          rawToken: params.receiptToken,
          requestUrl: request.url,
          scope: "receipt_read",
        }),
    },
  },
});
