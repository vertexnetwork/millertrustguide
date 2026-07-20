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

  // B2B recurring tier — per-state RECURRING Stripe Price IDs (monthly +
  // annual). Optional: a state without them simply isn't offered on the B2B
  // /business pricing page yet. These drive the Price-ID → state entitlement
  // map (see src/config/b2b.ts) and mirror the one-time stripePriceId above.
  stripeB2BPriceMonthly: z.string().optional(),
  stripeB2BPriceAnnual: z.string().optional(),

  // state-agency facts — Rule 1: officialTemplateUrl MUST point to .gov
  agencyName: z.string(),
  agencyAbbreviation: z.string(),
  officialTemplateUrl: z.string().url(),
  officialTemplateNote: z.string(),
  policyManualUrl: z.string().url(),
  policyManualSection: z.string(),
  // Short citation phrase used INLINE throughout the kit body (e.g. TX
  // "Appendix XXXVI"; NJ "QIT FAQ and model instrument"). Keeps per-state
  // citations accurate without leaking another state's section names.
  policyCitationShort: z.string(),
  // The state's LTC-Medicaid program label, used in the glossary (TX: MEPD /
  // "Medicaid for the Elderly and People with Disabilities"; NJ: MLTSS /
  // "Managed Long Term Services and Supports").
  ltcProgramAbbrev: z.string(),
  ltcProgramName: z.string(),
  // Where the spousal-allowance calculation lives, per state (TX: "Section 8 of
  // the HHSC handbook"; NJ: "the DMAHS Personal Responsibility (PR) form").
  spousalCalcRef: z.string(),
  // Post-death residuary payment instruction (how/where the trustee pays the
  // State its residuary share). State-specific prose.
  residuaryPaymentNote: z.string(),
  // Optional official "money receipt" / payment form the agency uses for
  // residuary payments (TX: Form H4100). Omit for states with no such form.
  residuaryFormName: z.string().optional(),
  residuaryFormUrl: z.string().url().optional(),

  // Some states split the QIT into MORE THAN ONE official document — e.g. Ohio
  // publishes a trust-instrument *template* (officialTemplateUrl) separately
  // from an agency *verification form* (ODM 10193) the trustee files with the
  // county. List those additional official .gov documents here; each renders
  // alongside the primary template on the state page and in the kit's source
  // appendices. TX/NJ have a single document and simply omit this. Keep every
  // url on a .gov/.us host to honor Rule 1 (link to the state's own publication).
  supplementalOfficialDocs: z
    .array(
      z.object({
        label: z.string(),
        url: z.string().url(),
        note: z.string(),
      })
    )
    .default([]),

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

  // ── Per-state persona/targeting modifiers ────────────────────────────────
  // Research-backed emphasis flags — see docs/state-persona-modifiers-research.md
  // for the cited source behind every value (never fabricated). These flex COPY
  // EMPHASIS, not regional culture: the buyer usually lives OUT of state (the
  // Phoenix daughter buying the Texas kit — see ad-campaign-playbook.md), so we
  // never regionalize ("Yeehaw, Texans"). The axis that actually varies per
  // state is structural, not cultural.
  //
  // medicaidStructure: does LTC Medicaid here use a hard income cap (QIT
  //   REQUIRED to qualify over the cap) vs medically-needy spend-down (no QIT)
  //   vs hybrid (QIT only for certain programs, e.g. HCBS waivers). All live
  //   states are income-cap by definition of selling a QIT kit; this records the
  //   verified classification and guards future state selection.
  // personaLean: which buyer the page should lead its fear-frame toward —
  //   'daughter' (adult child of a widowed parent → denial/ejection fear),
  //   'community-spouse' (married, home-owning → protect-the-house fear), or
  //   'balanced'. Derived conservatively from cited Census 65+ marital/
  //   homeownership data; defaults to 'balanced' when no clear signal.
  // primaryTerm: the instrument term the state agency itself uses / locals
  //   search ("Miller Trust" | "Qualified Income Trust" | "Income Trust").
  medicaidStructure: z.enum(['income-cap', 'spend-down', 'hybrid']).optional(),
  personaLean: z.enum(['daughter', 'community-spouse', 'balanced']).default('balanced'),
  primaryTerm: z.string().optional(),

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
