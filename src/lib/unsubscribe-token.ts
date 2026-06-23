// Signed unsubscribe tokens for the nurture series.
//
// RFC 8058 one-click unsubscribe needs a URL we can trust to identify the
// subscriber without a login. We sign the email with HMAC-SHA256 (same secret
// + pattern as download-token.ts) so the link can't be forged or enumerated,
// and embed it in the List-Unsubscribe header of every nurture email. No
// expiry — an unsubscribe link should keep working forever.
//
// No dependencies — Node's built-in crypto only.

import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const s = import.meta.env.DOWNLOAD_TOKEN_SECRET;
  if (!s) throw new Error('DOWNLOAD_TOKEN_SECRET is not configured.');
  return s;
}

function hmac(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

/** Mint a signed, non-expiring unsubscribe token for an email address. */
export function createUnsubscribeToken(email: string): string {
  const payloadB64 = Buffer.from(JSON.stringify({ e: email.toLowerCase() })).toString('base64url');
  return `${payloadB64}.${hmac(payloadB64)}`;
}

/** Verify an unsubscribe token; returns the email if valid, else null. */
export function verifyUnsubscribeToken(token: string): { email: string } | null {
  if (typeof token !== 'string' || token.length > 2048) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;

  const expectedSig = hmac(payloadB64);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let body: { e?: unknown };
  try {
    body = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof body.e !== 'string') return null;

  return { email: body.e };
}
