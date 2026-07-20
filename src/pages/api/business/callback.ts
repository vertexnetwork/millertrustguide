// B2B magic-link callback. Verifies the emailed link, burns its single-use
// nonce (if KV configured), re-confirms the license live against Stripe, then
// sets an HttpOnly session cookie and redirects into the portal.

import type { APIRoute } from 'astro';
import { verifyMagicLinkToken, createSessionToken } from '~/lib/session-token';
import { kvConsumeNonce } from '~/lib/kv';
import { findActiveB2BForEmail } from '~/lib/stripe-b2b';
import { B2B_SESSION_COOKIE, B2B_SESSION_TTL_MIN } from '~/config/b2b';
import { brandedPage } from '~/lib/html-response';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = url.searchParams.get('token');
  if (!token) {
    return brandedPage(
      400,
      'This sign-in link is incomplete',
      'The link appears to be missing part of its address. Please request a fresh link from the sign-in page.'
    );
  }

  const claims = verifyMagicLinkToken(token);
  if (!claims) {
    return brandedPage(
      403,
      'This sign-in link has expired',
      'Sign-in links are valid for a short time and can only be used once. Please request a fresh link from the sign-in page.'
    );
  }

  // Single-use burn (only enforceable when KV is configured).
  const nonce = await kvConsumeNonce(`magiclink:${claims.jti}`);
  if (nonce.enforced && !nonce.firstUse) {
    return brandedPage(
      403,
      'This sign-in link was already used',
      'For security, each link works only once. Please request a fresh link from the sign-in page.'
    );
  }

  // Re-confirm the license live before issuing a session.
  let ent;
  try {
    ent = await findActiveB2BForEmail(claims.email);
  } catch (err) {
    console.error('[b2b callback] entitlement lookup failed:', err);
    return brandedPage(
      500,
      'We could not verify your license right now',
      'Please try again in a moment. If this keeps happening, email support@millertrustguide.com.'
    );
  }
  if (!ent) {
    return brandedPage(
      403,
      'No active license found',
      'We could not find an active facility license for this email. If you just subscribed, give it a moment and try again — or email support@millertrustguide.com.'
    );
  }

  const verifiedAt = Math.floor(Date.now() / 1000);
  const { token: sessionToken } = createSessionToken({
    email: claims.email,
    customerId: ent.customerId,
    entitledStates: ent.entitledStates,
    facilityName: ent.facilityName,
    verifiedAt,
  });

  cookies.set(B2B_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: B2B_SESSION_TTL_MIN * 60,
  });

  return new Response(null, { status: 302, headers: { Location: '/business' } });
};
