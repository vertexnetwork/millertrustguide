// B2B entitlement resolution — Stripe is the source of truth.
//
// A facility's access is derived LIVE from its Stripe subscriptions, never from
// a local mirror: we map each active subscription item's Price ID → state slug
// (per-state prices live in .mdx frontmatter; the all-states bundle expands to
// every B2B-enabled state). Reading status live is more correct than a
// webhook-synced table and makes duplicate/out-of-order webhooks harmless.
//
// Stripe email is NOT unique — customers.list({email}) can return several
// Customer objects, so we scan all of them for an active subscription.

import { getCollection } from 'astro:content';
import { getStripe } from '~/lib/stripe';
import { isBundlePriceId } from '~/config/b2b';

// Subscription statuses that grant access. `past_due` keeps access during the
// dunning grace window; `canceled`/`unpaid`/`paused`/`incomplete*` do not.
const ACCESS_STATUSES = new Set(['active', 'trialing', 'past_due']);

/** Reverse map: B2B Price ID → state slug, for all live B2B-enabled states. */
export async function buildPriceStateMap(): Promise<Map<string, string>> {
  const states = await getCollection('states');
  const map = new Map<string, string>();
  for (const s of states) {
    if (s.data.status !== 'live') continue;
    if (s.data.stripeB2BPriceMonthly) map.set(s.data.stripeB2BPriceMonthly, s.slug);
    if (s.data.stripeB2BPriceAnnual) map.set(s.data.stripeB2BPriceAnnual, s.slug);
  }
  return map;
}

/** Every live state that has at least one B2B price (used to expand the bundle). */
export async function b2bEnabledStateSlugs(): Promise<string[]> {
  const states = await getCollection('states');
  return states
    .filter(
      (s) =>
        s.data.status === 'live' &&
        (s.data.stripeB2BPriceMonthly || s.data.stripeB2BPriceAnnual)
    )
    .map((s) => s.slug);
}

export interface B2BEntitlement {
  customerId: string;
  entitledStates: string[]; // state slugs (bundle expanded)
  status: string; // representative access-granting status
  facilityName?: string;
}

// Resolve one customer's entitlement from their subscriptions. `priceStateMap`
// and `bundleStates` are passed in so callers that loop over customers don't
// refetch the content collection per customer.
async function resolveForCustomer(
  customerId: string,
  priceStateMap: Map<string, string>,
  bundleStates: string[]
): Promise<Omit<B2BEntitlement, 'customerId'>> {
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });
  const states = new Set<string>();
  let status = 'none';
  let facilityName: string | undefined;

  for (const sub of subs.data) {
    if (!ACCESS_STATUSES.has(sub.status)) continue;
    status = sub.status;
    const fn = sub.metadata?.facility_name;
    if (fn && !facilityName) facilityName = fn;
    for (const item of sub.items.data) {
      const priceId = item.price.id;
      if (isBundlePriceId(priceId)) {
        bundleStates.forEach((s) => states.add(s));
      } else {
        const slug = priceStateMap.get(priceId);
        if (slug) states.add(slug);
      }
    }
  }

  return { entitledStates: [...states], status, facilityName };
}

/**
 * Find the active B2B entitlement for an email across ALL matching Stripe
 * customers. Returns null if none has an access-granting subscription.
 */
export async function findActiveB2BForEmail(email: string): Promise<B2BEntitlement | null> {
  const stripe = getStripe();
  const [priceStateMap, bundleStates] = await Promise.all([
    buildPriceStateMap(),
    b2bEnabledStateSlugs(),
  ]);

  const customers = await stripe.customers.list({ email: email.trim(), limit: 20 });
  let best: B2BEntitlement | null = null;
  for (const cust of customers.data) {
    const res = await resolveForCustomer(cust.id, priceStateMap, bundleStates);
    if (res.entitledStates.length > 0) {
      const ent: B2BEntitlement = { customerId: cust.id, ...res };
      // Prefer the customer with the widest entitlement (handles a facility
      // that somehow has both a single-state and a bundle sub under two ids).
      if (!best || ent.entitledStates.length > best.entitledStates.length) best = ent;
    }
  }
  return best;
}

/**
 * Re-resolve entitlement for a known customer id (the freshness re-check on the
 * download path). Returns entitledStates: [] if the subscription has lapsed.
 */
export async function resolveEntitlementForCustomer(
  customerId: string
): Promise<Omit<B2BEntitlement, 'customerId'>> {
  const [priceStateMap, bundleStates] = await Promise.all([
    buildPriceStateMap(),
    b2bEnabledStateSlugs(),
  ]);
  return resolveForCustomer(customerId, priceStateMap, bundleStates);
}

/** Create a Stripe Customer Portal session and return its URL. */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const configId = (import.meta.env.STRIPE_PORTAL_CONFIG_ID ?? '').trim();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    ...(configId ? { configuration: configId } : {}),
  });
  return session.url;
}
