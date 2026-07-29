const BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${import.meta.env.DEV ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const PERMISSIONS_POLICY = [
  "camera=()",
  "geolocation=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

type SecureResponseOptions = {
  request: Request;
  requestId: string;
};

export function withSecurityHeaders(
  response: Response,
  { request, requestId }: SecureResponseOptions,
): Response {
  const headers = new Headers(response.headers);
  const pathname = new URL(request.url).pathname;

  setIfMissing(headers, "content-security-policy", BASE_CONTENT_SECURITY_POLICY);
  setIfMissing(headers, "permissions-policy", PERMISSIONS_POLICY);
  setIfMissing(headers, "referrer-policy", "strict-origin-when-cross-origin");
  setIfMissing(headers, "x-content-type-options", "nosniff");
  setIfMissing(headers, "x-frame-options", "DENY");
  headers.set("x-request-id", requestId);

  if (isPrivateResponsePath(pathname)) {
    headers.set("cache-control", "private, no-store, max-age=0");
    headers.set("pragma", "no-cache");
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-robots-tag", "noindex, nofollow");
  }

  if (new URL(request.url).protocol === "https:") {
    setIfMissing(headers, "strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function isPrivateResponsePath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/_serverFn/") ||
    pathname === "/randevu-basarili" ||
    pathname === "/randevu-yonet" ||
    pathname.startsWith("/randevu-basarili/") ||
    pathname.startsWith("/randevu-yonet/")
  );
}

function setIfMissing(headers: Headers, name: string, value: string): void {
  if (!headers.has(name)) {
    headers.set(name, value);
  }
}
