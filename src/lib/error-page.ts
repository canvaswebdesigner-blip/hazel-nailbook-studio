const ERROR_PAGE_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>Sayfa yüklenemedi</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
  </head>
  <body>
    <main>
      <h1>Sayfa yüklenemedi</h1>
      <p>Beklenmeyen bir sorun oluştu. Sayfayı tekrar deneyebilir veya ana sayfaya dönebilirsin.</p>
      <form method="get">
        <button type="submit">Tekrar dene</button>
      </form>
      <p><a href="/">Ana sayfaya dön</a></p>
    </main>
  </body>
</html>`;
}

export function createErrorResponse(requestId: string): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-security-policy": ERROR_PAGE_CSP,
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-request-id": requestId,
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
