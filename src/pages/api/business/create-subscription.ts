// B2B subscription checkout. Mirrors /api/create-checkout (Rule-4 consent gate)
// but in mode:'subscription'. Resolves the recurring Price from per-state .mdx
// frontmatter (stripeB2BPrice{Monthly,Annual}) or the all-states bundle (env).
// The facility name is captured for co-branding and stored on the subscription
// metadata so entitlement resolution and the co-brand stamp can read it back.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getStripe } from '~/lib/stripe';
import {
  B2B_BUNDLE,
  B2B_PRODUCT_KIND,
  B2B_CONSENT_VERSION,
  type B2BBilling,
} from '~/config/b2b';

export const prerender = false;

interface Body {
  stateSlug?: string;
  bundle?: boolean;
  billing?: string;
  facilityName?: string;
  consent?: unknown;
  consentTimestamp?: string;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, 'Invalid request body.');
  }

  // Rule-4-style consent gate for the B2B license terms.
  if (body.consent !== true) {
    return jsonError(400, 'Please acknowledge the license terms to continue.');
  }

  const facilityName = typeof body.facilityName === 'string' ? body.facilityName.trim() : '';
  if (!facilityName) return jsonError(400, 'Please enter your facility or organization name.');
  if (facilityName.length > 120) return jsonError(400, 'That facility name is too long.');

  const billing: B2BBilling = body.billing === 'annual' ? 'annual' : 'monthly';
  const isBundle = body.bundle === true;

  let priceId = '';
  let b2bState = '';
  if (isBundle) {
    if (!B2B_BUNDLE.available) return jsonError(503, 'The all-states bundle is not available yet.');
    priceId = billing === 'annual' ? B2B_BUNDLE.annualPriceId : B2B_BUNDLE.monthlyPriceId;
    b2bState = 'bundle';
  } else {
    const slug = typeof body.stateSlug === 'string' ? body.stateSlug.trim().toLowerCase() : '';
    if (!slug) return jsonError(400, 'Missing state.');
    const states = await getCollection('states');
    const entry = states.find((s) => s.slug === slug);
    if (!entry || entry.data.status !== 'live') return jsonError(404, 'State not available.');
    priceId =
      (billing === 'annual' ? entry.data.stripeB2BPriceAnnual : entry.data.stripeB2BPriceMonthly) ?? '';
    b2bState = slug;
  }

  if (!priceId || priceId.startsWith('price_REPLACE_ME')) {
    return jsonError(
      503,
      'This plan is not configured yet. Please email support@millertrustguide.com and we will set it up.'
    );
  }

  const stripe = getStripe();
  const siteUrl =
    import.meta.env.SITE_URL?.replace(/\/$/, '') || 'https://millertrustguide.com';
  const consentTimestamp =
    typeof body.consentTimestamp === 'string' ? body.consentTimestamp : new Date().toISOString();
  const consentIp = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';

  // Stripe metadata values must be strings.
  const metadata: Record<string, string> = {
    product_kind: B2B_PRODUCT_KIND,
    facility_name: facilityName,
    b2b_state: b2bState,
    b2b_billing: billing,
    consent_acknowledged: 'true',
    consent_version: B2B_CONSENT_VERSION,
    consent_timestamp: consentTimestamp,
    consent_ip: consentIp,
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/business/login?welcome=1`,
      cancel_url: `${siteUrl}/business/pricing`,
      automatic_tax: { enabled: true },
      billing_address_collection: 'auto',
      tax_id_collection: { enabled: true },
      // Put the facility/consent data on the SUBSCRIPTION so it persists for the
      // whole license lifetime (entitlement + co-brand read it back).
      subscription_data: { metadata },
      metadata,
    });

    if (!session.url) return jsonError(500, 'Failed to create checkout session.');
    return json({ url: session.url });
  } catch (err) {
    console.error('[b2b create-subscription] Stripe error:', err);
    return jsonError(500, 'Something went wrong creating the checkout session.');
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
function jsonError(status: number, message: string) {
  return json({ error: message }, status);
}
