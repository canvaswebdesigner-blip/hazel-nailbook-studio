import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

import { getRequestId, isExpectedHttpError, logServerError } from "./lib/error-capture";
import { createErrorResponse } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    // Redirects and intentional 4xx responses are part of normal router
    // control flow and must retain their original status and headers.
    if (isExpectedHttpError(error)) {
      throw error;
    }

    const requestId = getRequestId(request);
    logServerError({
      error,
      operation: "request.middleware",
      request,
      requestId,
    });
    return createErrorResponse(requestId);
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
