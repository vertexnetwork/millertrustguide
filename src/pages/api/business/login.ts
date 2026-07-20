// B2B magic-link request. Always responds generically (no account enumeration).
// Rate-limited via KV by email + IP; if an active facility license exists for
// the email, we mint a single-use magic link and email it.

import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { findActiveB2BForEmail } from '~/lib/stripe-b2b';
import { createMagicLinkToken } from '~/lib/session-token';
import { sendMagicLinkEmail } from '~/lib/resend';
import { kvIncrWithTtl, kvSetJSON } from '~/lib/kv';
import { B2B_LOGIN_RATELIMIT, B2B_MAGICLINK_TTL_MIN } from '~/config/b2b';

export const prerender = false;

const GENERIC = {
  ok: true,
  message:
    'If that email has an active facility license, we just sent a sign-in link. Please check your inbox (and spam).',
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let email = '';
  try {
    const b = (await request.json()) as { email?: unknown };
    email = typeof b?.email === 'string' ? b.email.trim() : '';
  } catch {
    // fall through to generic
  }

  // Always respond generically to avoid revealing whether an account exists.
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return json(GENERIC);
  }

  // Rate-limit by email and by IP (best-effort; needs KV). IP gets a looser cap
  // since a shared NAT can front many legitimate facilities.
  const emailHash = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  const [byEmail, byIp] = await Promise.all([
    kvIncrWithTtl(`rl:login:e:${emailHash}`, B2B_LOGIN_RATELIMIT.windowSec),
    kvIncrWithTtl(`rl:login:i:${ip}`, B2B_LOGIN_RATELIMIT.windowSec),
  ]);
  const emailOver = byEmail !== null && byEmail > B2B_LOGIN_RATELIMIT.max;
  const ipOver = byIp !== null && byIp > B2B_LOGIN_RATELIMIT.max * 4;
  if (emailOver || ipOver) {
    // Silently drop — do not reveal rate-limit state to a prober.
    return json(GENERIC);
  }

  try {
    const ent = await findActiveB2BForEmail(email);
    if (ent) {
      const { token, jti, expiresAt } = createMagicLinkToken(email);
      // Register the nonce so the callback can burn it (single-use).
      await kvSetJSON(`magiclink:${jti}`, { email: email.toLowerCase() }, B2B_MAGICLINK_TTL_MIN * 60);
      const siteUrl =
        import.meta.env.SITE_URL?.replace(/\/$/, '') || 'https://millertrustguide.com';
      const loginUrl = `${siteUrl}/api/business/callback?token=${encodeURIComponent(token)}`;
      await sendMagicLinkEmail({ to: email, loginUrl, expiresAt });
    }
  } catch (err) {
    // Never leak failure specifics; log for the operator.
    console.error('[b2b login] error (returning generic):', err);
  }

  return json(GENERIC);
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
