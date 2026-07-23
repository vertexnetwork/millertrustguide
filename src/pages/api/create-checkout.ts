// Rule 4 server-side gate. Refuses to create a Stripe Checkout session if
// consent is missing or false. Consent record is mirrored into Stripe order
// metadata (consent_acknowledged, consent_timestamp, consent_ip) for ≥7-year
// retention per Stripe's order-retention policy.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getStripe } from '~/lib/stripe';
import { sanitizeRef } from '~/lib/referral';

export const prerender = false;

interface CheckoutRequest {
  stateSlug?: string;
  consent?: unknown;
  consentTimestamp?: string;
  ref?: unknown;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return jsonError(400, 'Invalid request body.');
  }

  // --- Rule 4: hard server-side consent gate -------------------------------
  if (body.consent !== true) {
    return jsonError(
      400,
      'Consent acknowledgment is required before checkout. Please check the acknowledgment box.'
    );
  }

  // --- Validate state slug --------------------------------------------------
  const slug = typeof body.stateSlug === 'string' ? body.stateSlug.trim().toLowerCase() : '';
  if (!slug) {
    return jsonError(400, 'Missing state.');
  }

  const states = await getCollection('states');
  const entry = states.find((s) => s.slug === slug);
  if (!entry) {
    return jsonError(404, 'State not available.');
  }
  const state = { ...entry.data, slug: entry.slug };

  if (state.status !== 'live') {
    return jsonError(
      403,
      state.status === 'blocked'
        ? `We do not currently sell a ${state.name} kit.`
        : `The ${state.name} kit is not yet available for purchase.`
    );
  }

  if (!state.stripePriceId || state.stripePriceId.startsWith('price_REPLACE_ME')) {
    return jsonError(
      500,
      'Checkout is not configured for this state yet. Please email support@millertrustguide.com.'
    );
  }

  // --- Build Stripe Checkout session ---------------------------------------
  const stripe = getStripe();

  const siteUrl =
    import.meta.env.SITE_URL?.replace(/\/$/, '') || 'https://millertrustguide.com';

  // --- Founder pricing -----------------------------------------------------
  // If a founder coupon is configured AND still valid, apply it. Stripe's
  // max_redemptions on the coupon enforces the "first N buyers" cutoff: once
  // the limit is reached Stripe flips coupon.valid to false, and from then on
  // checkout proceeds at full price with no code change. Any failure here is
  // non-fatal — checkout always falls back to full price.
  let founderDiscount: { coupon: string }[] | undefined;
  const founderCouponId = import.meta.env.STRIPE_FOUNDER_COUPON_ID;
  if (founderCouponId) {
    try {
      const coupon = await stripe.coupons.retrieve(founderCouponId);
      if (coupon.valid) founderDiscount = [{ coupon: founderCouponId }];
    } catch (err) {
      console.error('[create-checkout] founder coupon lookup failed; full price:', err);
    }
  }

  const consentTimestamp =
    typeof body.consentTimestamp === 'string' ? body.consentTimestamp : new Date().toISOString();

  const consentIp = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';

  // Facility-referral attribution (the B2B distribution wedge). '' when absent or
  // malformed; only written to Stripe when present. Never PII — it's a facility slug.
  const referralFacility = sanitizeRef(body.ref);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: state.stripePriceId, quantity: 1 }],
      ...(founderDiscount ? { discounts: founderDiscount } : {}),
      success_url: `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/states/${state.slug}`,
      automatic_tax: { enabled: true },
      billing_address_collection: 'auto',
      payment_intent_data: {
        statement_descriptor_suffix: state.abbreviation,
        description: `${state.name} Miller Trust Kit (informational guide)`,
        ...(referralFacility ? { metadata: { referral_facility: referralFacility } } : {}),
      },
      metadata: {
        state_slug: state.slug,
        state_name: state.name,
        pdf_blob_key: state.pdfBlobKey,
        consent_acknowledged: 'true',
        consent_timestamp: consentTimestamp,
        consent_ip: consentIp,
        product_kind: 'informational_guide',
        ...(referralFacility ? { referral_facility: referralFacility } : {}),
      },
      // Customer reference holds the same consent fields for redundancy.
      consent_collection: {
        terms_of_service: 'none',
      },
    });

    if (!session.url) {
      return jsonError(500, 'Failed to create checkout session.');
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('[create-checkout] Stripe error:', err);
    return jsonError(500, 'Something went wrong creating the checkout session.');
  }
};

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
