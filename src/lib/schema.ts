// JSON-LD generators. Schema.org Organization is "Organization" — never
// "LegalService" / "AttorneyService" / "ProfessionalService" (those imply
// credentials we do not have). Rule-aligned with LEGAL_GUARDRAILS.md.
//
// 2026 GEO/EEAT additions:
//   - WebSite schema with potentialAction (SearchAction) — site-wide entity.
//   - Person schema for the author byline, with sameAs scaffolding for
//     future credential resolution (state bar, ORCID, LinkedIn). The
//     anonymity doctrine keeps sameAs empty at launch; the hook is here
//     so a credentialed reviewer can be wired in without refactor.
//   - MedicalWebPage variant for QIT operational guides (Medicaid is health
//     adjacent; AI engines parse this for entity binding).
//   - GovernmentService schema linking each state page to the underlying
//     state Medicaid program — strong jurisdictional binding signal.
//   - Speakable annotations on the answer-first lede so voice/AI assistants
//     can extract the primary answer.
//   - reviewedBy hook on articleSchema (currently null; designed so a
//     credentialed reviewer can be added later without template changes).

import type { StateData } from '~/content/config';

const SITE_NAME = 'Miller Trust Guide';
const SITE_URL = 'https://millertrustguide.com';
const AUTHOR_NAME = 'James Whitfield';
const AUTHOR_URL = `${SITE_URL}/authors/james-whitfield`;
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const AUTHOR_ID = `${AUTHOR_URL}#person`;

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description:
      'Publisher of state-specific informational operational guides for using publicly-published Qualified Income Trust templates.',
    foundingDate: '2026-05-20',
    knowsAbout: [
      'Qualified Income Trust',
      'Miller Trust',
      'Medicaid long-term care eligibility',
      'Income-cap state Medicaid policy',
      'Medicaid Estate Recovery',
    ],
    email: 'support@millertrustguide.com',
    // sameAs intentionally empty per V5.3 anonymity doctrine.
    sameAs: [] as string[],
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/icon-512.png`,
      width: 512,
      height: 512,
    },
    publishingPrinciples: `${SITE_URL}/editorial-process`,
    diversityPolicy: `${SITE_URL}/editorial-process`,
    ethicsPolicy: `${SITE_URL}/disclaimer`,
    correctionsPolicy: `${SITE_URL}/editorial-process`,
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description:
      'State-specific operational guides for setting up Medicaid Qualified Income Trusts (Miller Trusts). Informational, not legal advice.',
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
    // Potential SearchAction tells search engines the homepage is a search
    // entry point. Cheap, well-supported.
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// Person schema for the author. sameAs is empty at launch (anonymity
// doctrine); the field is present so credentials can be added without
// schema refactor.
export function personSchema(opts: { jobTitle?: string; description?: string } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: AUTHOR_NAME,
    url: AUTHOR_URL,
    jobTitle: opts.jobTitle ?? 'Researcher',
    description:
      opts.description ??
      'Researcher and sole author of Miller Trust Guide. Reads state Medicaid policy manuals and publishes plain-English operational guides for Qualified Income Trusts. Not an attorney; does not advise on individual situations.',
    worksFor: { '@id': ORG_ID },
    // Empty per anonymity doctrine. Add state bar / ORCID / LinkedIn URLs
    // here if and when a credentialed reviewer is added.
    sameAs: [] as string[],
    knowsAbout: [
      'Qualified Income Trust',
      'Miller Trust',
      'Medicaid LTC eligibility',
      'State Medicaid policy manual synthesis',
    ],
  };
}

export function articleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified: string;
  // 2026 EEAT addition: separate editorial review date from content tweak date.
  lastReviewed?: string;
  // 2026 EEAT addition: credentialed reviewer hook. Pass a Person object or
  // omit. Anonymity doctrine keeps this null at launch.
  reviewedBy?: { name: string; jobTitle?: string; url?: string } | null;
  // 2026 GEO addition: mark the answer-first lede selector as speakable.
  speakableCssSelectors?: string[];
  // 2026 entity binding: array of @ids this article references (citations).
  citations?: string[];
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    author: { '@id': AUTHOR_ID, '@type': 'Person', name: AUTHOR_NAME, url: AUTHOR_URL },
    publisher: { '@id': ORG_ID },
    datePublished: opts.datePublished ?? opts.dateModified,
    dateModified: opts.dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': opts.url },
    inLanguage: 'en-US',
    isPartOf: { '@id': WEBSITE_ID },
  };
  if (opts.lastReviewed) base.lastReviewed = opts.lastReviewed;
  if (opts.reviewedBy) {
    base.reviewedBy = {
      '@type': 'Person',
      name: opts.reviewedBy.name,
      jobTitle: opts.reviewedBy.jobTitle,
      url: opts.reviewedBy.url,
    };
  }
  if (opts.speakableCssSelectors && opts.speakableCssSelectors.length > 0) {
    base.speakable = {
      '@type': 'SpeakableSpecification',
      cssSelector: opts.speakableCssSelectors,
    };
  }
  if (opts.citations && opts.citations.length > 0) {
    base.citation = opts.citations;
  }
  return base;
}

// MedicalWebPage variant for QIT pages. Medicaid is health-adjacent; AI
// engines (esp. Gemini) parse MedicalWebPage for entity binding into the
// health knowledge graph. We are NOT giving medical advice — the type
// signals that the topic is health-program eligibility, not that we are a
// medical authority.
export function medicalWebPageSchema(opts: {
  url: string;
  name: string;
  description: string;
  dateModified: string;
  lastReviewed?: string;
  reviewedBy?: { name: string; jobTitle?: string; url?: string } | null;
  audience?: string;
}) {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    '@id': `${opts.url}#medical-webpage`,
    url: opts.url,
    name: opts.name,
    description: opts.description,
    dateModified: opts.dateModified,
    audience: {
      '@type': 'MedicalAudience',
      audienceType: opts.audience ?? 'Patient',
    },
    medicalAudience: {
      '@type': 'MedicalAudience',
      audienceType: 'Patient',
    },
    inLanguage: 'en-US',
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORG_ID },
    about: {
      '@type': 'MedicalCondition',
      name: 'Long-term care Medicaid eligibility',
    },
  };
  if (opts.lastReviewed) base.lastReviewed = opts.lastReviewed;
  if (opts.reviewedBy) {
    base.reviewedBy = {
      '@type': 'Person',
      name: opts.reviewedBy.name,
      jobTitle: opts.reviewedBy.jobTitle,
      url: opts.reviewedBy.url,
    };
  }
  return base;
}

// GovernmentService schema binds each state page to the underlying state
// Medicaid LTC program. Underused but high-signal jurisdictional binding.
export function governmentServiceSchema(opts: {
  url: string;
  stateName: string;
  agencyName: string;
  policyManualUrl: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    '@id': `${opts.url}#government-service`,
    name: `${opts.stateName} Medicaid Long-Term Care (Qualified Income Trust pathway)`,
    serviceType: 'Medicaid long-term care benefit eligibility',
    audience: {
      '@type': 'PeopleAudience',
      audienceType: 'income-cap-state Medicaid LTC applicants',
    },
    provider: {
      '@type': 'GovernmentOrganization',
      name: opts.agencyName,
      url: opts.policyManualUrl,
    },
    areaServed: {
      '@type': 'State',
      name: opts.stateName,
    },
    termsOfService: opts.policyManualUrl,
  };
}

export function faqPageSchema(faqs: StateData['faq']) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

// Standalone FAQPage builder for non-state pages (homepage, about, etc.).
export function faqPageSchemaFromPairs(faqs: Array<{ question: string; answer: string }>) {
  return faqPageSchema(faqs as StateData['faq']);
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// HowTo schema for the "How to set up a Miller Trust in [State]" pillar
// article structure. AI engines extract step lists from HowTo even where
// the rich-result is restricted.
export function howToSchema(opts: {
  url: string;
  name: string;
  description: string;
  totalTime?: string;
  estimatedCost?: { value: number; currency: string };
  steps: Array<{ name: string; text: string; url?: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${opts.url}#howto`,
    name: opts.name,
    description: opts.description,
    totalTime: opts.totalTime,
    estimatedCost: opts.estimatedCost
      ? {
          '@type': 'MonetaryAmount',
          currency: opts.estimatedCost.currency,
          value: opts.estimatedCost.value,
        }
      : undefined,
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      url: s.url,
    })),
  };
}

// Product schema for the per-state kit. Keep type=Product (not Service) —
// this is a digital download, not a licensed service.
export function productSchema(opts: {
  url: string;
  name: string;
  description: string;
  price: number;
  stateAbbreviation: string;
  inStock?: boolean;
  /** Absolute URLs. At least one is required for Merchant Listing eligibility. */
  images: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${opts.url}#product`,
    name: opts.name,
    description: opts.description,
    image: opts.images,
    // brand must be a Brand or a minimal Organization (just @type + name).
    // Passing { '@id': ORG_ID } resolved to the full publisher Organization
    // and tripped Google's "Invalid object type for brand" check, so we
    // inline a minimal Organization here.
    brand: { '@type': 'Organization', name: SITE_NAME },
    category: 'Informational guide',
    offers: {
      '@type': 'Offer',
      url: opts.url,
      priceCurrency: 'USD',
      price: opts.price.toFixed(2),
      availability: opts.inStock ?? true ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@id': ORG_ID },
      // Digital download — free, instant. Required by Google Merchant Listing
      // rich-result eligibility even for digital goods.
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'USD' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'HUR' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'HUR' },
        },
      },
      // 30-day money-back per /refund-policy. Models the refund window —
      // the buyer keeps the file, so "return" is conceptual; Google accepts
      // this for digital products.
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
    areaServed: {
      '@type': 'State',
      name: opts.stateAbbreviation,
    },
  };
}
