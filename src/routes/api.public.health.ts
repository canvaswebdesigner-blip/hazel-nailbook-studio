import { createFileRoute } from "@tanstack/react-router";

import { getPublicHealthStatus } from "@/server/supabase/health.server";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const result = await getPublicHealthStatus();

        return Response.json(result, {
          status: result.status === "ok" ? 200 : 503,
          headers: {
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
