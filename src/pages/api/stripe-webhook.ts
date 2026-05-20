// Stripe webhook receiver. On `checkout.session.completed` we:
//   1. Verify signature (Stripe → us).
//   2. Look up the state by Stripe Price ID OR session metadata.state_slug.
//   3. Generate a 7-day signed Vercel Blob URL for the kit PDF.
//   4. Send the Postmark delivery email containing the download link.
//
// Signature verification needs the raw request body (bytes), which Astro
// exposes via `request.text()` — we MUST NOT call `request.json()` first.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getStripe, getWebhookSecret } from '~/lib/stripe';
import { getSignedKitUrl } from '~/lib/blob';
import { sendKitDeliveryEmail } from '~/lib/postmark';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const stripe = getStripe();
  const sig = request.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature.', { status: 400 });

  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, getWebhookSecret());
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err);
    return new Response('Invalid signature.', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  const session = event.data.object as import('stripe').Stripe.Checkout.Session;

  // Pull the buyer's email and state info from the session.
  const buyerEmail =
    session.customer_details?.email ?? session.customer_email ?? null;
  if (!buyerEmail) {
    console.error('[stripe-webhook] no buyer email on session:', session.id);
    return new Response('No buyer email.', { status: 400 });
  }

  const stateSlug = (session.metadata?.state_slug ?? '').toLowerCase();
  if (!stateSlug) {
    console.error('[stripe-webhook] missing state_slug on session metadata:', session.id);
    return new Response('Missing state slug.', { status: 400 });
  }

  // Rule 4 audit: consent must have been acknowledged before the session was
  // created. If it isn't on the session, our /api/create-checkout was bypassed.
  if (session.metadata?.consent_acknowledged !== 'true') {
    console.error('[stripe-webhook] session lacks consent metadata:', session.id);
    // We still issue a refund pathway by emailing support, but we do NOT deliver.
    return new Response('Consent metadata missing.', { status: 400 });
  }

  const states = await getCollection('states');
  const state = states.find((s) => s.data.slug === stateSlug)?.data;
  if (!state) {
    console.error('[stripe-webhook] no state matching slug:', stateSlug);
    return new Response('State not found.', { status: 404 });
  }

  // Generate signed Vercel Blob URL.
  let signed;
  try {
    signed = await getSignedKitUrl(state.pdfBlobKey);
  } catch (err) {
    console.error('[stripe-webhook] failed to generate signed URL:', err);
    return new Response('Storage error.', { status: 500 });
  }

  // Send the delivery email.
  try {
    await sendKitDeliveryEmail({
      to: buyerEmail,
      stateName: state.name,
      agencyAbbreviation: state.agencyAbbreviation,
      downloadUrl: signed.url,
      expiresAt: signed.expiresAt,
      orderId: session.id,
    });
  } catch (err) {
    console.error('[stripe-webhook] Postmark send failed:', err);
    return new Response('Email delivery failed.', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true, delivered: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
