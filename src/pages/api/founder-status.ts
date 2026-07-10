// Live founder-offer count for progressive enhancement (see FounderLive.astro).
//
//   GET /api/founder-status  ->  { unitsSold, unitLimit, spotsLeft, founderActive, founderPrice }
//
// Edge-cached so Stripe's coupon is queried at most ~once/minute regardless of
// traffic, with stale-while-revalidate so a visitor never waits on the round-trip.
// Stripe's max-redemptions coupon remains the HARD enforcement of the actual
// charge (create-checkout.ts); this endpoint only powers the on-site display.

import type { APIRoute } from 'astro';
import { getFounderStatus } from '~/lib/stripe';

export const prerender = false;

export const GET: APIRoute = async () => {
  const status = await getFounderStatus();
  return new Response(JSON.stringify(status), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, s-maxage=60, stale-while-revalidate=600',
    },
  });
};
