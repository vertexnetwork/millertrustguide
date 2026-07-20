// Clear the B2B session cookie and return to the sign-in page.

import type { APIRoute } from 'astro';
import { B2B_SESSION_COOKIE } from '~/config/b2b';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  cookies.delete(B2B_SESSION_COOKIE, { path: '/' });
  return new Response(null, { status: 302, headers: { Location: '/business/login?signed_out=1' } });
};
