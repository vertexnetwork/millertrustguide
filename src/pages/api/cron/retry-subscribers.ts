// Retry cron for the free-checklist signup path. Runs hourly (see
// vercel.json) and re-attempts every email queued by /api/subscribe after a
// failed Resend audience-add (src/lib/pending-subscribers.ts) — recovers a
// lead through a longer Resend outage than the inline in-request retry can
// absorb, without ever double-sending: a queued entry only exists because
// the inline attempt never got as far as sending the welcome email, so this
// cron is the ONLY place that email #1 gets sent for that address, exactly
// once, the first time a retry succeeds.
//
// Security: same Bearer CRON_SECRET pattern as cron/nurture.ts.

import type { APIRoute } from 'astro';
import { addSubscriberToAudience } from '~/lib/resend';
import { sendNurtureEmail } from '~/lib/nurture';
import {
  getPendingSubscribers,
  setPendingSubscribers,
  MAX_ATTEMPTS,
  type PendingSubscriber,
} from '~/lib/pending-subscribers';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/retry-subscribers] CRON_SECRET not configured.');
    return new Response('Not configured.', { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const pending = await getPendingSubscribers();
  if (pending.length === 0) {
    return json({ ok: true, processed: 0, succeeded: 0, stillPending: 0, abandoned: 0 });
  }

  const stillPending: PendingSubscriber[] = [];
  let succeeded = 0;
  let abandoned = 0;

  for (const entry of pending) {
    try {
      await addSubscriberToAudience(entry.email);
      // Only reachable once, for a given queued entry — the inline
      // /api/subscribe attempt never sent this because it failed before
      // getting here, so this is the address's one and only welcome email.
      await sendNurtureEmail(1, entry.email, entry.stateName, {
        slug: entry.stateSlug,
        privatePayLow: entry.privatePayLow,
        privatePayHigh: entry.privatePayHigh,
        legalGuide: entry.legalGuide,
      });
      succeeded++;
    } catch (err) {
      console.error(`[cron/retry-subscribers] retry failed for ${entry.email}:`, err);
      if (entry.attempts + 1 >= MAX_ATTEMPTS) {
        abandoned++;
      } else {
        stillPending.push({ ...entry, attempts: entry.attempts + 1 });
      }
    }
  }

  // Merge back anything that was queued WHILE this run was in flight (a new
  // failure landing between our initial read and this write), rather than
  // clobbering it. This queue has no atomic list ops, so this narrows the
  // race window rather than closing it entirely — an acceptable tradeoff for
  // a best-effort recovery path, not a system of record.
  const processedEmails = new Set(pending.map((e) => e.email));
  const arrivedDuringRun = (await getPendingSubscribers()).filter(
    (e) => !processedEmails.has(e.email)
  );
  await setPendingSubscribers([...stillPending, ...arrivedDuringRun]);

  const summary = {
    ok: true,
    processed: pending.length,
    succeeded,
    stillPending: stillPending.length,
    abandoned,
  };
  console.log('[cron/retry-subscribers]', JSON.stringify(summary));
  return json(summary);
};

function json(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
