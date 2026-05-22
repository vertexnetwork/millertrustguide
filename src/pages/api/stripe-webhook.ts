// Stripe webhook receiver. On `checkout.session.completed` we:
//   1. Verify signature (Stripe → us).
//   2. Look up the state by Stripe Price ID OR session metadata.state_slug.
//   3. Confirm the kit PDF exists in Blob storage.
//   4. Mint a 7-day signed download token and email the buyer a link to
//      our own /api/download endpoint (the Blob URL is never exposed).
//
// Signature verification needs the raw request body (bytes), which Astro
// exposes via `request.text()` — we MUST NOT call `request.json()` first.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getStripe, getWebhookSecret } from '~/lib/stripe';
import { kitBlobExists } from '~/lib/blob';
import { createDownloadToken } from '~/lib/download-token';
import { sendKitDeliveryEmail } from '~/lib/resend';

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
  const entry = states.find((s) => s.slug === stateSlug);
  if (!entry) {
    console.error('[stripe-webhook] no state matching slug:', stateSlug);
    return new Response('State not found.', { status: 404 });
  }
  const state = { ...entry.data, slug: entry.slug };

  // Confirm the kit PDF actually exists before we promise the buyer a
  // download. If it's missing we fail loudly (Stripe will retry) so the
  // operator notices and uploads it, rather than emailing a dead link.
  try {
    const exists = await kitBlobExists(state.pdfBlobKey);
    if (!exists) {
      console.error('[stripe-webhook] kit PDF missing at blob key:', state.pdfBlobKey);
      return new Response('Kit file not available.', { status: 500 });
    }
  } catch (err) {
    console.error('[stripe-webhook] blob existence check failed:', err);
    return new Response('Storage error.', { status: 500 });
  }

  // Mint a 7-day signed download token and build the link to our own
  // /api/download endpoint. The Blob URL itself is never sent to the buyer.
  const siteUrl =
    import.meta.env.SITE_URL?.replace(/\/$/, '') || 'https://millertrustguide.com';
  const { token, expiresAt } = createDownloadToken(state.slug, session.id);
  const downloadUrl = `${siteUrl}/api/download?token=${encodeURIComponent(token)}`;

  // Send the delivery email.
  try {
    await sendKitDeliveryEmail({
      to: buyerEmail,
      stateName: state.name,
      agencyAbbreviation: state.agencyAbbreviation,
      downloadUrl,
      expiresAt,
      orderId: session.id,
    });
  } catch (err) {
    console.error('[stripe-webhook] Resend send failed:', err);
    return new Response('Email delivery failed.', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true, delivered: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
