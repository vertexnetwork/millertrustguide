import { defineCollection, z } from 'astro:content';

const stateSchema = z.object({
  // identity
  slug: z.string(),
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
  personalNeedsAllowance: z.number(),
  asOf: z.string(),

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
});

export const collections = {
  states: defineCollection({ type: 'content', schema: stateSchema }),
};

export type StateData = z.infer<typeof stateSchema>;
