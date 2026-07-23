// Facility directory for the B2B distribution wedge.
//
// Each entry powers a free, co-branded checklist at /for/<slug> that a facility
// (or elder-law firm / advisor) can hand to the families it serves. The CTA on
// that page links to the state kit with ?ref=<slug>, so any resulting B2C sale
// is attributed back to the facility (Stripe metadata referral_facility). That
// per-facility conversion signal is the GAUGE: it tells us which facilities
// actually drive volume, so we later pitch the paid $149/mo co-branded LICENSE
// only to the proven distributors — free checklist = bait + distribution + gauge.
//
// SCALE: this seed list is illustrative. The real directory is ~4,000 facilities
// across the 10 live states, meant to be generated (e.g. from CMS "Nursing Home
// Compare" / Provider-of-Services data) and dropped in here as a larger array or
// a generated JSON import. The /for route is SSR, so a big list adds NO build
// cost. Every `state` MUST be a LIVE state slug or /for/<slug> redirects home.
//
// No visitor PII is involved — a facility slug is a business identifier.

export type FacilityKind = 'facility' | 'advisor';

export interface Facility {
  /** URL slug: lowercase kebab, unique. This is the ?ref= attribution key. */
  slug: string;
  /** Display name shown on the co-branded checklist. */
  name: string;
  /** LIVE state slug this facility serves (matches src/content/states/<slug>). */
  state: string;
  /** Optional city, shown under the name. */
  city?: string;
  /** Facility (default) vs advisor/firm — only tweaks a word of the copy. */
  kind?: FacilityKind;
}

// --- Seed / example entries (replace with the real generated directory) -------
// Names are generic placeholders (same "Maple Grove" convention used as the
// example in /business/pricing). Swap this array for the real ~4,000-row list.
export const FACILITIES: Facility[] = [
  { slug: 'maple-grove-skilled-nursing', name: 'Maple Grove Skilled Nursing', state: 'texas', city: 'Houston' },
  { slug: 'riverside-senior-care', name: 'Riverside Senior Care', state: 'ohio', city: 'Columbus' },
  { slug: 'oakwood-elder-law', name: 'Oakwood Elder Law', state: 'new-jersey', city: 'Trenton', kind: 'advisor' },
];

const BY_SLUG = new Map(FACILITIES.map((f) => [f.slug, f]));

/** Look up a facility by its slug (the [facility] route param). Case-insensitive. */
export function getFacility(slug: string): Facility | undefined {
  return BY_SLUG.get(slug.trim().toLowerCase());
}
