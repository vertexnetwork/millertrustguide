// The site's ONLY middleware. Scoped strictly to the B2B portal page so it
// cannot affect any B2C path. It guards exactly `/business` (the authenticated
// portal); the public B2B pages (`/business/login`, `/business/pricing`) and
// every API route, asset, and marketing page pass through untouched.

import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken } from '~/lib/session-token';
import { B2B_SESSION_COOKIE } from '~/config/b2b';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isPortal = pathname === '/business' || pathname === '/business/';
  if (!isPortal) return next();

  const raw = context.cookies.get(B2B_SESSION_COOKIE)?.value;
  const session = raw ? verifySessionToken(raw) : null;
  if (!session) {
    return context.redirect('/business/login');
  }

  // Expose the verified session to the portal page.
  context.locals.b2b = session;
  return next();
});
