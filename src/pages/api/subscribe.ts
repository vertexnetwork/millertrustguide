// Email-capture endpoint for the nurture series.
//
// Rule 2 (no personalized intake): this endpoint accepts an email address
// and nothing else. No name, no income, no age, no family/applicant facts.
// The optional stateSlug only selects which state's name appears in the
// welcome email copy — it is not a fact about the subscriber.
//
// Flow: validate email -> add to Resend Audience -> send nurture email #1.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { addSubscriberToAudience, sendNurtureWelcomeEmail } from '~/lib/resend';

export const prerender = false;

// Conservative email shape check. Final validation is Resend's; this just
// rejects obvious garbage before we spend an API call.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  let payload: { email?: unknown; stateSlug?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  // Resolve the state name for the welcome-email copy. Defaults to a generic
  // phrasing if no/unknown slug is passed.
  let stateName = 'your state';
  const slug = typeof payload.stateSlug === 'string' ? payload.stateSlug.toLowerCase() : '';
  if (slug) {
    const states = await getCollection('states');
    const entry = states.find((s) => s.slug === slug);
    if (entry) stateName = entry.data.name;
  }

  // Add to the audience. If this fails we stop — no point sending a welcome
  // email to someone we couldn't record.
  try {
    await addSubscriberToAudience(email);
  } catch (err) {
    console.error('[subscribe] failed to add contact to audience:', err);
    return json(
      { error: 'Something went wrong on our end. Please try again in a minute.' },
      502
    );
  }

  // Send nurture email #1. A failure here is non-fatal — the contact is
  // already on the list and will still receive the scheduled series emails.
  try {
    await sendNurtureWelcomeEmail(email, stateName);
  } catch (err) {
    console.error('[subscribe] welcome email send failed (contact still subscribed):', err);
    return json(
      { ok: true, note: 'Subscribed. The first email may take a few minutes to arrive.' },
      200
    );
  }

  return json({ ok: true }, 200);
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
