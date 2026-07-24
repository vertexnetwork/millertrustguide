// Read-only, machine-readable index of the state guides — served at
// /data/states.json. This is the structured-data twin of /llms.txt: it exposes
// ONLY facts already public on each state page (caps, agency, official template
// URL, status, price) so agentic tools and AI answer engines can consume the
// site without scraping HTML. It is the surface described by
// /.well-known/openapi.json and advertised by /.well-known/ai-plugin.json.
//
// Deliberately NEVER includes operator-internal fields (stripePriceId,
// pdfBlobKey) — those stay server-side. Source of truth is the content
// collection, so the payload can never claim coverage we do not actually ship.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://millertrustguide.com';

export const GET: APIRoute = async () => {
  const entries = (await getCollection('states'))
    .map((s) => ({ ...s.data, slug: s.slug }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const states = entries.map((s) => ({
    name: s.name,
    abbreviation: s.abbreviation,
    slug: s.slug,
    url: `${SITE}/states/${s.slug}`,
    status: s.status, // 'live' | 'draft' | 'blocked'
    purchasable: s.status === 'live',
    price: s.status === 'live' ? s.price : null,
    priceCurrency: 'USD',
    incomeCap2026Single: s.incomeCap2026,
    incomeCap2026Couple: s.incomeCapCouple2026,
    incomeCapAsOf: s.asOf,
    ltcProgram: { abbreviation: s.ltcProgramAbbrev, name: s.ltcProgramName },
    agency: { name: s.agencyName, abbreviation: s.agencyAbbreviation },
    primaryTerm: s.primaryTerm ?? 'Miller Trust',
    productModel: s.productModel, // 'template' (official fill-in form exists) | 'requirements-brief' (no state form; requirements checklist instead)
    // null for 'requirements-brief' states — no state publishes a fill-in
    // instrument for them (that's the whole reason for the product-model fork).
    officialTemplateUrl: s.officialTemplateUrl ?? null,
    policyManualUrl: s.policyManualUrl,
    policyManualSection: s.policyManualSection,
    reviewedDate: s.reviewedDate,
    blockedReason: s.status === 'blocked' ? (s.blockedReason ?? null) : null,
  }));

  const body = {
    '@context': 'https://millertrustguide.com/.well-known/openapi.json',
    publisher: 'Miller Trust Guide',
    description:
      'Machine-readable index of state-specific Qualified Income Trust (Miller Trust) guides. Informational only — not legal advice. Most states publish an official fill-in template (officialTemplateUrl); a small number publish no template at all (productModel: "requirements-brief"), in which case the guide is a required-provisions checklist instead — see policyManualUrl for the governing source either way.',
    disclaimer:
      'Miller Trust Guide is a researcher-run informational publisher, not a law firm. Facts are sourced from each state Medicaid agency policy manual. For situation-specific advice, consult a licensed elder-law attorney in the applicable state.',
    federalIncomeCapBasis: '300% of the 2026 Federal Benefit Rate (effective 2026-01-01)',
    liveStateCount: states.filter((s) => s.purchasable).length,
    totalDocumentedStates: states.length,
    states,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Cache: long-lived but revalidate; the index changes only when a state
      // ships or annual figures update.
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
};
