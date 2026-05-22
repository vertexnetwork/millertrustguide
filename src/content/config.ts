import { defineCollection, z } from 'astro:content';

// Note: `slug` is a reserved Astro frontmatter field — Astro strips it from
// `data` before schema validation, so it cannot appear in this Zod object.
// At runtime we inject `slug` from `entry.slug` wherever state data is used;
// the StateData type below reflects that augmentation.
const stateSchema = z.object({
  // identity
  name: z.string(),
  abbreviation: z.string().length(2),

  // status — controls visibility and buy-flow rendering
  status: z.enum(['live', 'draft', 'blocked']),
  blockedReason: z.string().optional(),

  // commerce — Rule 1: no buy without a real Stripe Price ID
  stripePriceId: z.string(),
  pdfBlobKey: z.string(),
  price: z.number(),
  multiStateBundleEligible: z.boolean().default(true),

  // state-agency facts — Rule 1: officialTemplateUrl MUST point to .gov
  agencyName: z.string(),
  agencyAbbreviation: z.string(),
  officialTemplateUrl: z.string().url(),
  officialTemplateNote: z.string(),
  policyManualUrl: z.string().url(),
  policyManualSection: z.string(),

  // 2026 figures (annual update target)
  incomeCap2026: z.number(),
  incomeCapCouple2026: z.number(),
  personalNeedsAllowance: z.number(),
  asOf: z.string(),

  // federal-statute citation that authorizes the QIT
  federalStatuteCitation: z.string().default('42 U.S.C. § 1396p(d)(4)(B)'),
  federalStatuteUrl: z.string().url().default('https://www.law.cornell.edu/uscode/text/42/1396p'),

  // state-specific trustee + bank operational facts (used by the PDF kit)
  //
  // trusteeGuidanceNote: prose paragraph describing the state's actual posture
  // on trustee selection. Many states (incl. Texas per HHSC Appendix XXXVI)
  // do not statutorily prohibit specific trustees but do recommend against
  // certain choices. Use this prose field to capture the *exact* state
  // language; do not paraphrase into a stronger "prohibited" claim.
  trusteeGuidanceNote: z.string(),
  einRequired: z.boolean(),
  einRequiredNote: z.string(),
  stateBarLrsName: z.string(),
  stateBarLrsUrl: z.string().url(),

  // additional attorney-referral resources the state agency cites by name
  // (e.g., HHSC names NAELA, Advocacy Inc., legal aid offices, area agencies
  // on aging). Populate per-state from the state agency's own published list.
  additionalLegalAidReferrals: z.array(z.string()).default([]),

  // operational specifics (drives content blocks)
  commonDenialReasons: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      agencyCitation: z.string(),
    })
  ),
  bankRefusalNotes: z.array(
    z.object({
      refusalType: z.string(),
      response: z.string(),
      documentNeeded: z.string().optional(),
    })
  ),
  postDeathDistribution: z.string(),

  // SEO
  metaTitle: z.string(),
  metaDescription: z.string(),
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),

  // legal / UPL safety
  reviewedDate: z.string(),
  uplNotes: z.string().optional(),

  // delay-cost anchor (per DEMOGRAPHICS lever #1) — state-specific private-pay range
  privatePayMonthlyLow: z.number(),
  privatePayMonthlyHigh: z.number(),

  // FAQ — schema.org FAQPage data
  faq: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    })
  ),

  // kit version metadata — visible on the PDF cover + changelog page
  kitVersion: z.string(),
  kitVersionDate: z.string(),
  kitChangelog: z.array(
    z.object({
      version: z.string(),
      date: z.string(),
      changes: z.array(z.string()),
    })
  ),

  // social proof — honest, no fabricated reviews/case studies.
  // unitsSold is operator-maintained; bump it and redeploy. The visible
  // buyer count only renders once unitsSold >= displayThreshold; below the
  // threshold the page shows honest "be one of our first" launch framing.
  socialProof: z.object({
    unitsSold: z.number().default(0),
    displayThreshold: z.number().default(25),
    launchLabel: z.string(),
    // Founder pricing. While unitsSold < founderUnitLimit, the state page
    // shows the founder offer; Stripe enforces the actual discount via a
    // max-redemptions coupon (see create-checkout.ts). Optional — a state
    // with no founder offer simply omits these.
    founderPrice: z.number().optional(),
    founderUnitLimit: z.number().optional(),
  }),
});

export const collections = {
  states: defineCollection({ type: 'content', schema: stateSchema }),
};

export type StateData = z.infer<typeof stateSchema> & { slug: string };
