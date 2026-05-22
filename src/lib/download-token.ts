// Signed, time-limited download tokens for kit delivery.
//
// The kit PDF lives in Vercel Blob and its storage URL is never exposed to a
// buyer. Instead the Stripe webhook mints one of these tokens and emails a
// link to /api/download?token=... — that endpoint verifies the token and
// streams the PDF. The token is the access-control gate:
//
//   - HMAC-SHA256 signed with DOWNLOAD_TOKEN_SECRET — cannot be forged.
//   - Carries an expiry — genuinely stops working after 7 days.
//   - Carries the order id — every purchase gets a distinct token, so a
//     future revocation list can target a single order if needed.
//
// No dependencies — Node's built-in crypto only.

import { createHmac, timingSafeEqual } from 'node:crypto';

// Download links are valid for 7 days from purchase.
export const DOWNLOAD_LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  const s = import.meta.env.DOWNLOAD_TOKEN_SECRET;
  if (!s) throw new Error('DOWNLOAD_TOKEN_SECRET is not configured.');
  return s;
}

function hmac(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

export interface DownloadTokenClaims {
  stateSlug: string;
  orderId: string;
  expiresAt: string; // ISO 8601
}

/**
 * Mint a signed download token for a completed purchase. Returns both the
 * token and the human-readable expiry (for the delivery email copy).
 */
export function createDownloadToken(
  stateSlug: string,
  orderId: string
): { token: string; expiresAt: string } {
  const expSeconds = Math.floor(Date.now() / 1000) + DOWNLOAD_LINK_TTL_SECONDS;
  const body = { s: stateSlug, oid: orderId, exp: expSeconds };
  const payloadB64 = Buffer.from(JSON.stringify(body)).toString('base64url');
  const token = `${payloadB64}.${hmac(payloadB64)}`;
  return { token, expiresAt: new Date(expSeconds * 1000).toISOString() };
}

/**
 * Verify a download token. Returns the claims if the signature is valid AND
 * the token has not expired; returns null on any failure (bad shape, bad
 * signature, expired, unparseable).
 */
export function verifyDownloadToken(token: string): DownloadTokenClaims | null {
  if (typeof token !== 'string' || token.length > 2048) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;

  // Constant-time signature comparison.
  const expectedSig = hmac(payloadB64);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let body: { s?: unknown; oid?: unknown; exp?: unknown };
  try {
    body = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    typeof body.s !== 'string' ||
    typeof body.oid !== 'string' ||
    typeof body.exp !== 'number'
  ) {
    return null;
  }

  if (body.exp * 1000 < Date.now()) return null; // expired

  return {
    stateSlug: body.s,
    orderId: body.oid,
    expiresAt: new Date(body.exp * 1000).toISOString(),
  };
}
