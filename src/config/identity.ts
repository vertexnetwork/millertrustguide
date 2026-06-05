// SINGLE SOURCE OF TRUTH for the site's external-identity E-E-A-T signals.
//
// Everything here is INTENTIONALLY EMPTY at launch under the V5.3 anonymity
// doctrine (see /humans.txt). This is the ONE place to add real signals when
// the operator decides to: a credentialed content reviewer and/or owned,
// verifiable profile URLs. schema.ts and the page layouts read these constants,
// so populating this file flows the data into Organization, Person, Article,
// and MedicalWebPage JSON-LD with no further code changes.
//
// DO NOT invent values. Fabricated E-E-A-T on YMYL (Medicaid/legal) content is
// worse than none — it is a trust violation and an indexing risk. Only add a
// URL the entity genuinely controls, or a reviewer who genuinely reviewed.

export interface Reviewer {
  name: string;
  jobTitle?: string;
  url?: string;
}

// Real, verifiable URLs identifying THIS publisher elsewhere (Wikidata,
// Crunchbase, LinkedIn company page, Better Business Bureau, etc.).
export const ORG_SAME_AS: string[] = [];

// Real, verifiable URLs identifying the AUTHOR elsewhere (state bar profile,
// ORCID, LinkedIn, Muck Rack). Empty per anonymity doctrine.
export const AUTHOR_SAME_AS: string[] = [];

// A credentialed human who has reviewed the content — ideally a licensed
// elder-law attorney. null = not reviewed by an outside credential (current
// state). Set this to a Reviewer object to populate `reviewedBy` across every
// Article and MedicalWebPage on the site at once.
export const REVIEWER: Reviewer | null = null;
