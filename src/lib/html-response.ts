// Small branded HTML response for B2B API routes (sign-in / download gates).
// Mirrors the friendly error page in src/pages/api/download.ts so a blocked
// action never feels like a raw error. noindex + no-store.

export function brandedPage(status: number, heading: string, body: string): Response {
  const html = `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${heading} — Miller Trust Guide</title>
    <style>
      body { font-family: -apple-system, 'Segoe UI', system-ui, sans-serif; background: #FAFAF7; color: #1F2937; line-height: 1.6; margin: 0; }
      main { max-width: 34rem; margin: 0 auto; padding: 4rem 1.5rem; }
      .bar { height: 0.3rem; background: #115E59; }
      h1 { font-family: 'Source Serif Pro', Georgia, serif; color: #0F4C4A; font-size: 1.6rem; margin: 0 0 0.75rem; }
      .eyebrow { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; color: #115E59; margin: 0 0 0.5rem; }
      a { color: #115E59; }
      p { margin: 0.75rem 0; }
      .btn { display:inline-block; margin-top: 1rem; background:#115E59; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600; }
    </style>
  </head>
  <body>
    <div class="bar"></div>
    <main>
      <p class="eyebrow">Miller Trust Guide — Business</p>
      <h1>${heading}</h1>
      <p>${body}</p>
      <p><a class="btn" href="/business/login">Go to sign-in</a></p>
      <p style="margin-top:2rem;font-size:0.9rem;color:#6B7280;">
        Support: <a href="mailto:support@millertrustguide.com">support@millertrustguide.com</a>
      </p>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
