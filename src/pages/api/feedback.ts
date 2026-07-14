// Kit feedback endpoint. Backs the /feedback form.
//
// This captures feedback about the KIT (did it open, was the walkthrough clear,
// what to improve, what worked, and whether we may quote them). It intentionally
// does NOT solicit facts about the buyer's own Medicaid situation, so it stays
// clear of Rule 2 (no personalized intake) — the form copy says so plainly.
//
// Capture path: format the submission and email it to the operator inbox via
// Resend. A reply address, if given, becomes the email's replyTo so the operator
// can answer directly. If the send fails we return an error so the submitter can
// retry rather than lose their note silently.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sendFeedbackEmail } from '~/lib/resend';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clip(v: unknown, max: number): string {
  return (typeof v === 'string' ? v : '').trim().slice(0, max);
}

export const POST: APIRoute = async ({ request }) => {
  let p: Record<string, unknown>;
  try {
    p = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  // Honeypot: real people never fill this hidden field, bots do. Pretend success
  // so the bot does not retry, but send nothing.
  if (clip(p.company, 200)) return json({ ok: true }, 200);

  const stateSlug = clip(p.state, 40).toLowerCase();
  const opened = clip(p.opened, 60);
  const clarity = clip(p.clarity, 60);
  const improve = clip(p.improve, 5000);
  const worked = clip(p.worked, 5000);
  const permission = clip(p.permission, 60);
  const name = clip(p.name, 120);
  const email = clip(p.email, 254).toLowerCase();
  const order = clip(p.order, 120);

  // Require at least one substantive answer so the operator never gets an empty ping.
  if (!improve && !worked && !opened && !clarity) {
    return json({ error: 'Please answer at least one question before sending.' }, 400);
  }
  if (email && !EMAIL_RE.test(email)) {
    return json(
      { error: 'That email address does not look right. Leave it blank if you prefer.' },
      400
    );
  }

  // Resolve the state name for a readable subject/body. Optional, best-effort.
  let stateName = stateSlug || 'unspecified state';
  if (stateSlug) {
    const states = await getCollection('states');
    const entry = states.find((s) => s.slug === stateSlug);
    if (entry) stateName = entry.data.name;
  }

  const text = [
    `New kit feedback for ${stateName}.`,
    order ? `Order reference: ${order}` : '',
    '',
    `Downloaded and opened OK: ${opened || '(no answer)'}`,
    `Walkthrough clarity: ${clarity || '(no answer)'}`,
    '',
    'What tripped them up, or could be clearer:',
    improve || '(none given)',
    '',
    'What worked well:',
    worked || '(none given)',
    '',
    `Permission to quote: ${permission || '(no answer)'}`,
    `Name they gave: ${name || '(none)'}`,
    `Reply address: ${email || '(none)'}`,
  ].join('\n');

  try {
    await sendFeedbackEmail({
      subject: `Kit feedback: ${stateName}${email ? ' (reply requested)' : ''}`,
      text,
      replyTo: email || undefined,
    });
  } catch (err) {
    console.error('[feedback] send failed:', err);
    return json(
      {
        error:
          'Something went wrong on our end. Please email support@millertrustguide.com and we will make sure your note reaches us.',
      },
      502
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
