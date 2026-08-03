// Durable retry queue for a failed Resend audience-add on the free-checklist
// signup path. The in-request retry in src/lib/resend.ts (addSubscriberToAudience)
// absorbs a brief blip; if it still fails, we don't want to lose the lead
// entirely, so the email lands here for the retry cron to pick up later.
//
// The checklist itself is already delivered immediately regardless (see
// lead-capture.ts) — this queue only recovers the "add to the mailing list +
// send the welcome email" side, so a longer Resend outage doesn't mean the
// contact is gone for good, and so the person isn't emailed twice: the
// welcome email (#1) is only ever sent once, either inline in /api/subscribe
// on the happy path, or by the retry cron once a queued entry finally
// succeeds — never both, since a queued entry only exists because the
// inline attempt already failed before sending anything.
//
// Backed by KV (Upstash Redis) via src/lib/kv.ts — a single JSON array under
// one key, since volume here should be rare (only genuine Resend/network
// failures land here, not every signup). When KV isn't configured, queuing
// is a no-op (same degrade-gracefully posture as the rest of kv.ts) — a
// failed signup just isn't recoverable, exactly as it wasn't before this
// feature existed.

import { kvGetJSON, kvSetJSON } from '~/lib/kv';

const KEY = 'pending-subscribers';
const TTL_SEC = 7 * 24 * 60 * 60; // give up after a week of failures
export const MAX_ATTEMPTS = 5;

export interface PendingSubscriber {
  email: string;
  stateSlug?: string;
  stateName: string;
  privatePayLow?: number;
  privatePayHigh?: number;
  legalGuide?: boolean;
  createdAt: string; // ISO
  attempts: number;
}

export async function getPendingSubscribers(): Promise<PendingSubscriber[]> {
  return (await kvGetJSON<PendingSubscriber[]>(KEY)) ?? [];
}

export async function setPendingSubscribers(list: PendingSubscriber[]): Promise<void> {
  await kvSetJSON(KEY, list, TTL_SEC);
}

/**
 * Queue (or refresh) a failed signup for later retry. Dedupes by email —
 * resubmitting the same address (e.g. retrying the form themselves) just
 * refreshes the record with attempts reset, rather than creating a second
 * entry that could later fire two welcome emails.
 */
export async function queuePendingSubscriber(
  entry: Pick<
    PendingSubscriber,
    'email' | 'stateSlug' | 'stateName' | 'privatePayLow' | 'privatePayHigh' | 'legalGuide'
  >
): Promise<void> {
  const list = await getPendingSubscribers();
  const next = list.filter((e) => e.email !== entry.email);
  next.push({ ...entry, createdAt: new Date().toISOString(), attempts: 0 });
  await setPendingSubscribers(next);
}
