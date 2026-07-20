// Kit download endpoint. The delivery email links here, not to Vercel Blob.
//
//   GET /api/download?token=<signed token>
//
// Flow: verify the HMAC-signed, time-limited token -> resolve the state ->
// stream the private kit PDF back as an attachment. An invalid or expired
// token returns a friendly HTML page, not a raw error — an expired link is
// an expected event (a buyer clicking on day 9) and should not feel like a
// dead end.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { verifyDownloadToken } from '~/lib/download-token';
import { getKitBlobBytes } from '~/lib/blob';
import { stampPdf } from '~/lib/watermark';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) {
    return errorPage(
      400,
      'This download link is incomplete',
      'The link appears to be missing part of its address. Please use the full link from your delivery email, or contact support and we will send a fresh one.'
    );
  }

  const claims = verifyDownloadToken(token);
  if (!claims) {
    return errorPage(
      403,
      'This download link has expired',
      'For security, kit download links are valid for 7 days after purchase. Reply to your receipt email, or email support@millertrustguide.com from the address you used at checkout, and we will send you a fresh link right away — at no charge.'
    );
  }

  const states = await getCollection('states');
  const entry = states.find((s) => s.slug === claims.stateSlug);
  if (!entry) {
    return errorPage(
      404,
      'Kit not found',
      'We could not match this link to a kit. Please email support@millertrustguide.com and we will sort it out.'
    );
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await getKitBlobBytes(entry.data.pdfBlobKey);
  } catch (err) {
    console.error('[download] failed to resolve kit blob:', err);
    return errorPage(
      500,
      'We could not retrieve your kit',
      'Something went wrong on our end fetching the file. Please email support@millertrustguide.com and we will send it to you directly.'
    );
  }

  // Watermark the delivered copy with the purchaser's identity ("Social DRM").
  // A stamping failure must NEVER block a paid download — we log it and fall
  // back to the un-stamped bytes so the buyer always receives their kit.
  let delivered: Uint8Array = pdfBytes;
  try {
    const buyer = [claims.buyerName, claims.buyerEmail]
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(' · ');
    delivered = await stampPdf(pdfBytes, {
      footerLines: [
        buyer ? `Licensed to ${buyer}` : 'Licensed copy',
        `Order ${claims.orderId} — Licensed for personal household use, not for redistribution. © Miller Trust Guide`,
      ],
      diagonalText: claims.buyerEmail || claims.buyerName || undefined,
      metadataId: claims.orderId,
    });
  } catch (err) {
    console.error('[download] watermarking failed; serving un-stamped copy:', err);
    delivered = pdfBytes;
  }

  const filename = `${claims.stateSlug}-miller-trust-setup-kit.pdf`;

  // Copy into a fresh ArrayBuffer-backed Uint8Array so the body is a
  // well-typed BodyInit (pdf-lib/@vercel/blob hand back Uint8Array<ArrayBufferLike>).
  const body = new Uint8Array(delivered.byteLength);
  body.set(delivered);

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      // Never let a CDN or browser cache the paid file.
      'cache-control': 'private, no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
};

function errorPage(status: number, heading: string, body: string): Response {
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
    </style>
  </head>
  <body>
    <div class="bar"></div>
    <main>
      <p class="eyebrow">Miller Trust Guide</p>
      <h1>${heading}</h1>
      <p>${body}</p>
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
