// One-click unsubscribe endpoint for the nurture series (RFC 8058).
//
//   POST /api/unsubscribe?token=...  → performs the unsubscribe. This is what
//        a mailbox provider's native "Unsubscribe" button hits (List-Unsubscribe
//        + List-Unsubscribe-Post headers), and what the confirm button below
//        submits.
//   GET  /api/unsubscribe?token=...  → shows a confirmation page with a POST
//        button. We deliberately DO NOT unsubscribe on GET: email security
//        scanners and link prefetchers issue GETs, and a GET side effect would
//        unsubscribe people who never clicked.
//
// The token is an HMAC-signed email (unsubscribe-token.ts); only the recipient
// ever receives it, so it can't be forged or enumerated.

import type { APIRoute } from 'astro';
import { verifyUnsubscribeToken } from '~/lib/unsubscribe-token';
import { unsubscribeContact } from '~/lib/resend';

export const prerender = false;

// Escape before reflecting the email into HTML. Tokens are HMAC-signed so this
// is belt-and-suspenders, but the email is still user-derived data.
function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function htmlPage(title: string, message: string, status: number): Response {
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /><title>${title} — Miller Trust Guide</title></head>
<body style="font-family:-apple-system,Segoe UI,system-ui,sans-serif;color:#1F2937;line-height:1.6;max-width:560px;margin:0 auto;padding:48px 24px;">
  <h1 style="font-family:Georgia,serif;color:#0F4C4A;">${title}</h1>
  ${message}
  <p style="margin-top:32px;"><a href="https://millertrustguide.com" style="color:#115E59;">Return to Miller Trust Guide</a></p>
</body></html>`;
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// POST = perform the unsubscribe (native one-click button + the confirm form).
export const POST: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  const claims = token ? verifyUnsubscribeToken(token) : null;
  if (!claims) {
    return htmlPage('Link not valid', '<p>This unsubscribe link is invalid or incomplete. Reply to any of our emails with "unsubscribe" and we will remove you within one business day.</p>', 400);
  }
  try {
    await unsubscribeContact(claims.email);
  } catch (err) {
    console.error('[unsubscribe] failed for', claims.email, err);
    return htmlPage('Something went wrong', `<p>We could not process the unsubscribe automatically. Reply to any of our emails with "unsubscribe" and we will remove <strong>${esc(claims.email)}</strong> within one business day.</p>`, 502);
  }
  return htmlPage('You\'re unsubscribed', `<p><strong>${esc(claims.email)}</strong> has been removed from the Miller Trust Guide email series. You will not receive further emails from the series.</p>`, 200);
};

// GET = confirmation page only (no side effect — prefetch/scanner safe).
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  const claims = token ? verifyUnsubscribeToken(token) : null;
  if (!claims) {
    return htmlPage('Link not valid', '<p>This unsubscribe link is invalid or incomplete. Reply to any of our emails with "unsubscribe" and we will remove you within one business day.</p>', 400);
  }
  const action = `/api/unsubscribe?token=${encodeURIComponent(token!)}`;
  return htmlPage(
    'Unsubscribe',
    `<p>Click below to stop receiving the Miller Trust Guide email series at <strong>${esc(claims.email)}</strong>.</p>
  <form method="POST" action="${action}" style="margin-top:24px;">
    <button type="submit" style="background:#B45309;color:#fff;padding:12px 22px;border-radius:6px;border:none;font-weight:600;font-size:16px;cursor:pointer;">Unsubscribe ${esc(claims.email)}</button>
  </form>`,
    200
  );
};
