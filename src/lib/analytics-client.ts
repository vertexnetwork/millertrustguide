// Client-side custom-event helper for Vercel Web Analytics.
//
// The Vercel adapter (webAnalytics.enabled in astro.config.mjs) injects the
// analytics script, which defines window.va. We call it directly rather than
// adding the @vercel/analytics package, so we never risk double-injecting the
// script and add no dependency. Every call is guarded: analytics must NEVER
// throw or block the page (ad-blockers / local dev leave window.va undefined).
//
// Events we emit (the conversion funnel):
//   lead_submit       — email captured on the lead-magnet form
//   buy_click         — consent given + buy button pressed
//   checkout_redirect — Stripe Checkout URL returned, about to redirect
//   purchase          — payment confirmed on the thanks page (deduped per order)

declare global {
  interface Window {
    va?: (event: 'event' | 'beforeSend' | 'pageview', properties?: unknown) => void;
  }
}

export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>
): void {
  try {
    window.va?.('event', data ? { name, data } : { name });
  } catch {
    /* analytics must never break the page */
  }
}

export {};
