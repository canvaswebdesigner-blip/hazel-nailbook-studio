import { createFileRoute } from "@tanstack/react-router";

import { exchangeAdminRecoveryCode } from "@/server/auth/admin-password-recovery.server";

export const Route = createFileRoute("/admin/auth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => exchangeAdminRecoveryCode(request),
    },
  },
});
