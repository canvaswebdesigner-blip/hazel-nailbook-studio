const ERROR_TEXT_LIMIT = 4_000;
const STACK_LINE_LIMIT = 20;
const requestIds = new WeakMap<Request, string>();

const REDACTION_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, "Bearer [REDACTED]"],
  [/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, "[JWT]"],
  [
    /((?:["'`])?\b(?:password|passwd|secret|token|authorization|api[-_]?key|service[-_]?role)\b(?:["'`])?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[^\s,;}]+)/gi,
    "$1[REDACTED]",
  ],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]"],
  [/(?<!\d)(?:\+?90|0)?5\d{9}(?!\d)/g, "[PHONE]"],
  [/\b(?:sk|pk|eyJ)[-_A-Za-z0-9]{20,}\b/g, "[SECRET]"],
  [/\b[A-Z]:\\Users\\[^\\\s]+\\/gi, "C:\\Users\\[USER]\\"],
  [/\/(?:Users|home)\/[^/\s]+\//g, "/home/[USER]/"],
];

export type SafeErrorCategory = "http_error" | "response_error" | "runtime_error" | "unknown_error";

type SafeErrorDetails = {
  category: SafeErrorCategory;
  name?: string;
  message: string;
  stack?: string;
  status?: number;
};

export type ServerErrorLogInput = {
  error: unknown;
  operation: string;
  requestId: string;
  request?: Request;
  status?: number;
};

export function createRequestId(): string {
  return globalThis.crypto.randomUUID();
}

export function attachRequestId(request: Request, requestId: string): void {
  requestIds.set(request, requestId);
}

export function getRequestId(request: Request): string {
  return requestIds.get(request) ?? createRequestId();
}

export function redactText(value: string): string {
  // Bound work before running regular expressions against untrusted error text.
  let output = value.slice(0, ERROR_TEXT_LIMIT * 2);

  for (const [pattern, replacement] of REDACTION_RULES) {
    output = output.replace(pattern, replacement);
  }

  // Query strings and fragments can contain form values or private links.
  output = output.replace(/\bhttps?:\/\/[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?/gi, (url) =>
    safeUrlForLog(url),
  );

  return output.slice(0, ERROR_TEXT_LIMIT);
}

export function safePathForLog(requestOrUrl: Request | string): string {
  try {
    const url = new URL(typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url);
    const segments = url.pathname.split("/").map((segment, index, allSegments) => {
      const previous = allSegments[index - 1];
      if (
        previous === "randevu-basarili" ||
        previous === "randevu-yonet" ||
        looksLikePrivateValue(segment)
      ) {
        return "[REDACTED]";
      }
      return segment;
    });
    return segments.join("/") || "/";
  } catch {
    return "/";
  }
}

export function describeError(error: unknown): SafeErrorDetails {
  if (error instanceof Response) {
    return {
      category: "response_error",
      message: `Response ${error.status}`,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    const status = getErrorStatus(error);
    return {
      category: status ? "http_error" : "runtime_error",
      name: redactText(error.name || "Error"),
      message: redactText(error.message || "Unexpected server error"),
      stack: sanitizeStack(error.stack),
      status,
    };
  }

  return {
    category: "unknown_error",
    message: "Non-Error value thrown",
  };
}

export function logServerError({
  error,
  operation,
  requestId,
  request,
  status,
}: ServerErrorLogInput): void {
  const details = describeError(error);
  const event = {
    level: "error",
    requestId,
    operation,
    method: request?.method,
    path: request ? safePathForLog(request) : undefined,
    category: details.category,
    errorName: details.name,
    errorMessage: details.message,
    errorStack: details.stack,
    status: status ?? details.status ?? 500,
    timestamp: new Date().toISOString(),
  };

  // Keep the payload structured for the hosting log pipeline. Values are
  // deliberately allowlisted above; request headers, bodies and query strings
  // are never serialized.
  console.error(JSON.stringify(event));
}

export function isExpectedHttpError(error: unknown): boolean {
  if (error instanceof Response) {
    return error.status < 500;
  }

  const status = getErrorStatus(error);
  return typeof status === "number" && status < 500;
}

function getErrorStatus(error: unknown): number | undefined {
  if (error == null || typeof error !== "object") return undefined;
  const { status, statusCode } = error as {
    status?: unknown;
    statusCode?: unknown;
  };
  const value = status ?? statusCode;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return redactText(stack.split("\n").slice(0, STACK_LINE_LIMIT).join("\n"));
}

function safeUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${safePathForLog(url.toString())}`;
  } catch {
    return "[URL]";
  }
}

function looksLikePrivateValue(segment: string): boolean {
  if (!segment) return false;
  if (segment.length >= 32 && /^[A-Za-z0-9._~-]+$/.test(segment)) return true;
  return /^[A-Fa-f0-9]{32,}$/.test(segment);
}
