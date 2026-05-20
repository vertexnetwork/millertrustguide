// Rule 4 server-side gate. Refuses to create a Stripe Checkout session if
// consent is missing or false. Consent record is mirrored into Stripe order
// metadata (consent_acknowledged, consent_timestamp, consent_ip) for ≥7-year
// retention per Stripe's order-retention policy.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getStripe } from '~/lib/stripe';

export const prerender = false;

interface CheckoutRequest {
  stateSlug?: string;
  consent?: unknown;
  consentTimestamp?: string;
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

  const consentTimestamp =
    typeof body.consentTimestamp === 'string' ? body.consentTimestamp : new Date().toISOString();

  const consentIp = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: state.stripePriceId, quantity: 1 }],
      success_url: `${siteUrl}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/states/${state.slug}`,
      automatic_tax: { enabled: true },
      billing_address_collection: 'auto',
      payment_intent_data: {
        statement_descriptor_suffix: state.abbreviation,
        description: `${state.name} Miller Trust Kit (informational guide)`,
      },
      metadata: {
        state_slug: state.slug,
        state_name: state.name,
        pdf_blob_key: state.pdfBlobKey,
        consent_acknowledged: 'true',
        consent_timestamp: consentTimestamp,
        consent_ip: consentIp,
        product_kind: 'informational_guide',
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
