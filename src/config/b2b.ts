// B2B recurring-license tier config. Pure constants + env reads (mirrors the
// founder.ts convention). The Price-ID → state map that needs the content
// collection lives in src/lib/stripe-b2b.ts, not here, so this stays importable
// anywhere without pulling in astro:content.
//
// Pricing model (operator decision): per-STATE recurring — $149/mo per state,
// annual at a discount. Per-state Price IDs live in each state's .mdx
// frontmatter (stripeB2BPriceMonthly / stripeB2BPriceAnnual). An optional
// all-states BUNDLE (env below) serves multi-state chains.

// --- Bundle (all-states) recurring Price IDs, from env -----------------------
const bundleMonthly = (import.meta.env.STRIPE_B2B_BUNDLE_MONTHLY ?? '').trim();
const bundleAnnual = (import.meta.env.STRIPE_B2B_BUNDLE_ANNUAL ?? '').trim();

export const B2B_BUNDLE = {
  monthlyPriceId: bundleMonthly,
  annualPriceId: bundleAnnual,
  /** True once at least one bundle price is configured (controls its display). */
  available: Boolean(bundleMonthly || bundleAnnual),
};

/** Is this Stripe Price ID one of the all-states bundle prices? */
export function isBundlePriceId(priceId: string): boolean {
  return Boolean(priceId) && (priceId === bundleMonthly || priceId === bundleAnnual);
}

// --- Display pricing (keep in sync with the Stripe prices you create) --------
// Monthly is the fixed $149/state anchor. Annual is illustrative for the
// marketing page; the actual charge is whatever the Stripe annual Price says.
export const B2B_PRICING = {
  currency: 'USD',
  monthly: 149,
  annual: 1490, // ≈ 2 months free; update if you set a different Stripe price
  bundleMonthly: 499, // suggested anchor — operator sets the real Stripe price
  bundleAnnual: 4990,
} as const;

export type B2BBilling = 'monthly' | 'annual';

// --- Auth / session tunables -------------------------------------------------
function envMinutes(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const B2B_SESSION_TTL_MIN = envMinutes(import.meta.env.B2B_SESSION_TTL_MINUTES, 60);
export const B2B_MAGICLINK_TTL_MIN = envMinutes(import.meta.env.B2B_MAGICLINK_TTL_MINUTES, 15);

/** Entitlement-status cache TTL in KV (seconds). Stripe stays source of truth. */
export const B2B_STATUS_CACHE_TTL_SEC = 600; // 10 min
/**
 * On sensitive actions (PDF download) re-verify against Stripe live if the
 * session's snapshot is older than this — bounds post-cancellation access.
 */
export const B2B_FRESHNESS_REVERIFY_SEC = 300; // 5 min

/** Login rate-limit: max magic-link sends per email/IP per window. */
export const B2B_LOGIN_RATELIMIT = { max: 5, windowSec: 3600 } as const;

// --- Constants ---------------------------------------------------------------
export const B2B_SESSION_COOKIE = 'mtg_b2b_session';
export const B2B_PRODUCT_KIND = 'b2b_facility_license';
/** Bump when the B2B licence terms change (recorded in checkout metadata). */
export const B2B_CONSENT_VERSION = '2026-07-19';
