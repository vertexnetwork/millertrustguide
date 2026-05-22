// Nurture drip cron. Runs once daily (see vercel.json) and sends each
// subscriber the nurture email due for their age in the series.
//
// Why this is database-free: pacing is derived purely from each Resend
// contact's signup date. Each daily run, a contact's integer
// days-since-signup increases by exactly 1, so it equals each scheduled day
// (3, 8, 14, 21) on exactly one run — meaning each email fires once per
// contact with no progress-tracking store.
//
// Tradeoff: if a daily run is missed entirely (a platform outage), a
// contact can skip the email scheduled for that day. Acceptable for a
// nurture series — a skipped educational email is low-stakes, and a
// catch-up window would reintroduce double-send risk without a store.
//
// Security: Vercel attaches `Authorization: Bearer <CRON_SECRET>` to cron
// invocations when CRON_SECRET is set. We reject anything else.

import type { APIRoute } from 'astro';
import { listAudienceContacts } from '~/lib/resend';
import { NURTURE_SCHEDULE, sendNurtureEmail } from '~/lib/nurture';

export const prerender = false;

const DAY_MS = 86_400_000;

export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/nurture] CRON_SECRET not configured.');
    return new Response('Not configured.', { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized.', { status: 401 });
  }

  let contacts;
  try {
    contacts = await listAudienceContacts();
  } catch (err) {
    console.error('[cron/nurture] failed to list audience contacts:', err);
    return new Response('Failed to list contacts.', { status: 502 });
  }

  const now = Date.now();
  let sent = 0;
  let failed = 0;
  let skippedUnsub = 0;

  for (const contact of contacts) {
    if (contact.unsubscribed) {
      skippedUnsub++;
      continue;
    }
    const created = new Date(contact.createdAt).getTime();
    if (!Number.isFinite(created)) continue;

    const daysOld = Math.floor((now - created) / DAY_MS);
    const due = NURTURE_SCHEDULE.find((s) => s.day === daysOld);
    if (!due) continue;

    try {
      await sendNurtureEmail(due.emailNumber, contact.email);
      sent++;
    } catch (err) {
      console.error(
        `[cron/nurture] send failed — email ${due.emailNumber} to ${contact.email}:`,
        err
      );
      failed++;
    }
  }

  const summary = { ok: true, contacts: contacts.length, sent, failed, skippedUnsub };
  console.log('[cron/nurture]', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
