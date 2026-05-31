// Stripe webhook receiver. On `checkout.session.completed` we:
//   1. Verify signature (Stripe → us).
//   2. Look up the state by Stripe Price ID OR session metadata.state_slug.
//   3. Confirm the kit PDF exists in Blob storage.
//   4. Mint a 7-day signed download token and email the buyer a link to
//      our own /api/download endpoint (the Blob URL is never exposed).
//
// Signature verification needs the raw request body (bytes), which Astro
// exposes via `request.text()` — we MUST NOT call `request.json()` first.
//
// Every post-payment failure path fires an operator alert (sendOperatorAlert)
// so a paid-but-undelivered order can never fail silently. Stripe auto-retries
// 5xx for ~3 days, so fixing the cause self-heals pending retries.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getStripe, getWebhookSecret } from '~/lib/stripe';
import { kitBlobExists } from '~/lib/blob';
import { createDownloadToken } from '~/lib/download-token';
import { sendKitDeliveryEmail, sendOperatorAlert } from '~/lib/resend';

export const prerender = false;

// Alert the operator about a failed (paid) webhook, then return the response.
// Best-effort alert; never blocks the HTTP response on the alert succeeding.
async function alertAndRespond(
  status: number,
  publicMessage: string,
  detail: string,
  ctx: { sessionId?: string; email?: string | null; state?: string } = {}
): Promise<Response> {
  await sendOperatorAlert({
    subject: `⚠️ MTG webhook ${status}: ${publicMessage}`,
    lines: [
      'A Stripe checkout.session.completed webhook failed — a PAID order may not have been delivered.',
      '',
      `Status:  ${status}`,
      `Reason:  ${detail}`,
      ...(ctx.sessionId ? [`Session: ${ctx.sessionId}`] : []),
      ...(ctx.email ? [`Buyer:   ${ctx.email}`] : []),
      ...(ctx.state ? [`State:   ${ctx.state}`] : []),
      '',
      'Recover: fix the cause, then Stripe Dashboard → Developers → Webhooks → this event → Resend.',
      'Stripe also auto-retries 5xx for ~3 days, so a fix may self-heal pending retries.',
    ],
  });
  return new Response(publicMessage, { status });
}

export const POST: APIRoute = async ({ request }) => {
  const stripe = getStripe();
  const sig = request.headers.get('stripe-signature');
  // No signature header → not a Stripe delivery (bot/health probe). Don't alert.
  if (!sig) return new Response('Missing signature.', { status: 400 });

  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, getWebhookSecret());
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err);
    // Real Stripe events failing here means STRIPE_WEBHOOK_SECRET is wrong for
    // this endpoint — every order would silently fail. Worth an alert.
    return alertAndRespond(
      400,
      'Invalid signature.',
      'stripe.webhooks.constructEvent failed — STRIPE_WEBHOOK_SECRET likely does not match this endpoint (or a forged request).'
    );
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
    return alertAndRespond(400, 'No buyer email.', 'session had no customer_details.email / customer_email', {
      sessionId: session.id,
    });
  }

  const stateSlug = (session.metadata?.state_slug ?? '').toLowerCase();
  if (!stateSlug) {
    console.error('[stripe-webhook] missing state_slug on session metadata:', session.id);
    return alertAndRespond(400, 'Missing state slug.', 'session.metadata.state_slug was empty', {
      sessionId: session.id,
      email: buyerEmail,
    });
  }

  // Rule 4 audit: consent must have been acknowledged before the session was
  // created. If it isn't on the session, our /api/create-checkout was bypassed.
  if (session.metadata?.consent_acknowledged !== 'true') {
    console.error('[stripe-webhook] session lacks consent metadata:', session.id);
    // We still issue a refund pathway by emailing support, but we do NOT deliver.
    return alertAndRespond(
      400,
      'Consent metadata missing.',
      'session.metadata.consent_acknowledged !== "true" — create-checkout may have been bypassed (e.g. a raw Payment Link).',
      { sessionId: session.id, email: buyerEmail, state: stateSlug }
    );
  }

  const states = await getCollection('states');
  const entry = states.find((s) => s.slug === stateSlug);
  if (!entry) {
    console.error('[stripe-webhook] no state matching slug:', stateSlug);
    return alertAndRespond(404, 'State not found.', `no state content entry matched slug "${stateSlug}"`, {
      sessionId: session.id,
      email: buyerEmail,
      state: stateSlug,
    });
  }
  const state = { ...entry.data, slug: entry.slug };

  // Confirm the kit PDF actually exists before we promise the buyer a
  // download. If it's missing we fail loudly (Stripe will retry) so the
  // operator notices and uploads it, rather than emailing a dead link.
  try {
    const exists = await kitBlobExists(state.pdfBlobKey);
    if (!exists) {
      console.error('[stripe-webhook] kit PDF missing at blob key:', state.pdfBlobKey);
      return alertAndRespond(
        500,
        'Kit file not available.',
        `kit PDF missing in Vercel Blob at key "${state.pdfBlobKey}" — build + upload it (npm run kits:build -- ${state.slug}; npm run kit:upload -- ${state.slug}).`,
        { sessionId: session.id, email: buyerEmail, state: state.slug }
      );
    }
  } catch (err) {
    console.error('[stripe-webhook] blob existence check failed:', err);
    return alertAndRespond(500, 'Storage error.', `Vercel Blob existence check threw: ${String(err)}`, {
      sessionId: session.id,
      email: buyerEmail,
      state: state.slug,
    });
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
    return alertAndRespond(500, 'Email delivery failed.', `sendKitDeliveryEmail threw: ${String(err)}`, {
      sessionId: session.id,
      email: buyerEmail,
      state: state.slug,
    });
  }

  return new Response(JSON.stringify({ received: true, delivered: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
