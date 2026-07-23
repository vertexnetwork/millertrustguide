// Facility-referral attribution — the B2B distribution wedge's conversion gauge.
//
// A free co-branded checklist at /for/<facility> links families to the state kit
// with ?ref=<facility>. We persist that ref client-side so a purchase minutes (or
// days) later is still attributable to the facility that drove it. It is read at
// checkout and written into Stripe metadata (referral_facility) + the purchase
// analytics event — the per-facility signal that tells us which facilities to
// later pitch the paid $149/mo co-branded LICENSE to.
//
// Privacy: the ref is a FACILITY slug (a business identifier), never anything
// about the visitor. No PII is stored. Rule 2 (no personalized intake) unaffected.

const KEY = 'mtg_ref';
// 90 days — comfortably past the 1–6 week buying window, with slack for the
// family that sits on it. Last-touch: the most recent facility link wins.
const TTL_MS = 90 * 24 * 60 * 60 * 1000;
// Facility slugs are lowercase kebab. Reject anything else so a hostile or
// malformed ?ref= can't smuggle junk into our analytics or Stripe metadata.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

interface StoredRef {
  ref: string;
  t: number; // capture timestamp (ms since epoch)
}

/**
 * Read ?ref= from the current URL and persist it (last-touch). Safe to call on
 * every page load — no-ops when there's no ref, and never throws.
 */
export function captureRef(): void {
  try {
    const raw = (new URL(window.location.href).searchParams.get('ref') || '')
      .toLowerCase()
      .trim();
    if (!raw || raw.length > 64 || !SLUG_RE.test(raw)) return;
    const rec: StoredRef = { ref: raw, t: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* storage blocked / private mode — attribution is best-effort, never fatal */
  }
}

/** The current stored facility ref, or '' if none / expired / invalid. */
export function getRef(): string {
  try {
    const rec = JSON.parse(window.localStorage.getItem(KEY) || 'null') as StoredRef | null;
    if (!rec || typeof rec.ref !== 'string' || !SLUG_RE.test(rec.ref)) return '';
    if (Date.now() - rec.t > TTL_MS) return '';
    return rec.ref;
  } catch {
    return '';
  }
}

/**
 * Server-side sanitizer for a ref received at an API boundary (create-checkout).
 * Returns the clean slug or '' — mirrors the client SLUG_RE so both ends agree.
 */
export function sanitizeRef(value: unknown): string {
  if (typeof value !== 'string') return '';
  const v = value.trim().toLowerCase();
  return SLUG_RE.test(v) ? v : '';
}
