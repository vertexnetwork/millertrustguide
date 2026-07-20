// HMAC-signed tokens for the B2B /business portal — the same primitive as
// src/lib/download-token.ts, signed with a SEPARATE secret (B2B_SESSION_SECRET)
// so rotating B2B sessions never invalidates outstanding B2C download links.
//
// Two token types:
//   - magic link  (t:'ml')   — emailed to log in. Short TTL, carries email +
//     a random jti so KV can enforce single-use (see src/lib/kv.ts).
//   - session     (t:'sess') — set as an HttpOnly cookie after login. Carries
//     the resolved entitlement snapshot + `verifiedAt` so the download route
//     can re-check Stripe once the snapshot goes stale.
//
// No dependencies beyond Node's crypto.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { B2B_MAGICLINK_TTL_MIN, B2B_SESSION_TTL_MIN } from '~/config/b2b';

function secret(): string {
  const s = import.meta.env.B2B_SESSION_SECRET;
  if (!s) throw new Error('B2B_SESSION_SECRET is not configured.');
  return s;
}

function hmac(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url');
}

function sign(body: Record<string, unknown>): string {
  const payloadB64 = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${payloadB64}.${hmac(payloadB64)}`;
}

// Verify signature + expiry; return the decoded body or null on any failure.
function verify(token: string): Record<string, unknown> | null {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;

  const expected = hmac(payloadB64);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof body.exp !== 'number' || body.exp * 1000 < Date.now()) return null;
  return body;
}

// --- Magic link --------------------------------------------------------------

export interface MagicLinkToken {
  token: string;
  jti: string;
  expiresAt: string; // ISO 8601
}

export function createMagicLinkToken(email: string): MagicLinkToken {
  const jti = randomBytes(12).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + B2B_MAGICLINK_TTL_MIN * 60;
  const token = sign({ t: 'ml', em: email.toLowerCase(), jti, exp });
  return { token, jti, expiresAt: new Date(exp * 1000).toISOString() };
}

export interface MagicLinkClaims {
  email: string;
  jti: string;
}

export function verifyMagicLinkToken(token: string): MagicLinkClaims | null {
  const body = verify(token);
  if (!body || body.t !== 'ml') return null;
  if (typeof body.em !== 'string' || typeof body.jti !== 'string') return null;
  return { email: body.em, jti: body.jti };
}

// --- Session cookie ----------------------------------------------------------

export interface SessionClaims {
  email: string;
  customerId: string;
  entitledStates: string[]; // state slugs
  facilityName?: string;
  verifiedAt: number; // unix seconds — when entitlement was last confirmed live
}

export function createSessionToken(claims: SessionClaims): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + B2B_SESSION_TTL_MIN * 60;
  const token = sign({
    t: 'sess',
    em: claims.email.toLowerCase(),
    cid: claims.customerId,
    st: claims.entitledStates,
    fn: claims.facilityName ?? null,
    va: claims.verifiedAt,
    exp,
  });
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifySessionToken(token: string): SessionClaims | null {
  const body = verify(token);
  if (!body || body.t !== 'sess') return null;
  if (
    typeof body.em !== 'string' ||
    typeof body.cid !== 'string' ||
    !Array.isArray(body.st) ||
    typeof body.va !== 'number'
  ) {
    return null;
  }
  return {
    email: body.em,
    customerId: body.cid,
    entitledStates: (body.st as unknown[]).filter((x): x is string => typeof x === 'string'),
    facilityName: typeof body.fn === 'string' ? body.fn : undefined,
    verifiedAt: body.va,
  };
}
