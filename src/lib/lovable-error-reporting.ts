import { redactText, safePathForLog } from "./error-capture";

type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Response
      ? `Response ${error.status}`
      : error instanceof Error
        ? redactText(error.message || "Unexpected client error")
        : redactText(String(error));
  const safeError = new Error(message);
  safeError.name = error instanceof Error ? redactText(error.name || "Error") : "Error";
  safeError.stack = undefined;
  const safeRoute = safePathForLog(window.location.href);

  window.__lovableEvents?.captureException?.(
    safeError,
    {
      source: "react_error_boundary",
      route: safeRoute,
      ...sanitizeContext(context),
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Prod React does not rethrow boundary-caught errors to window.onerror, so the
  // editor's telemetry never sees them. Forward to lovable.js's reporting hook,
  // which is present only inside the editor preview.
  window.__lovableReportRuntimeError?.({
    message,
    filename: safeRoute,
  });
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context)
      .slice(0, 20)
      .map(([key, value]) => {
        const safeKey = redactText(key).slice(0, 80);
        if (value == null || typeof value === "number" || typeof value === "boolean") {
          return [safeKey, value];
        }
        return [safeKey, typeof value === "string" ? redactText(value) : "[OMITTED]"];
      }),
  );
}
