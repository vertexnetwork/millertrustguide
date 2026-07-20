// Redirect an authenticated facility to the Stripe Customer Portal (update
// card, switch monthly/annual, cancel). Session-gated; Stripe owns the UI.

import type { APIRoute } from 'astro';
import { verifySessionToken } from '~/lib/session-token';
import { createPortalSession } from '~/lib/stripe-b2b';
import { B2B_SESSION_COOKIE } from '~/config/b2b';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const raw = cookies.get(B2B_SESSION_COOKIE)?.value;
  const session = raw ? verifySessionToken(raw) : null;
  if (!session) {
    return new Response(null, { status: 302, headers: { Location: '/business/login' } });
  }

  const siteUrl =
    import.meta.env.SITE_URL?.replace(/\/$/, '') || 'https://millertrustguide.com';
  try {
    const portalUrl = await createPortalSession(session.customerId, `${siteUrl}/business`);
    return new Response(null, { status: 302, headers: { Location: portalUrl } });
  } catch (err) {
    console.error('[b2b portal] error:', err);
    return new Response(null, { status: 302, headers: { Location: '/business?portal=error' } });
  }
};
