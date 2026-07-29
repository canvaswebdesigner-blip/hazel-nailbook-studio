import { attachRequestId, createRequestId, logServerError } from "./lib/error-capture";
import { createErrorResponse } from "./lib/error-page";
import { withSecurityHeaders } from "./lib/security-headers";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 can turn catastrophic in-handler failures into this opaque JSON response.
// The request middleware normally catches application failures first; this is
// a final boundary for errors that occur outside that middleware.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  request: Request,
  requestId: string,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  logServerError({
    error: new Error("The SSR runtime returned an opaque unhandled error"),
    operation: "ssr.catastrophic_response",
    request,
    requestId,
    status: response.status,
  });
  return createErrorResponse(requestId);
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = createRequestId();
    attachRequestId(request, requestId);

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response, request, requestId);
      return withSecurityHeaders(normalized, { request, requestId });
    } catch (error) {
      logServerError({
        error,
        operation: "server.fetch",
        request,
        requestId,
      });
      return withSecurityHeaders(createErrorResponse(requestId), {
        request,
        requestId,
      });
    }
  },
};
