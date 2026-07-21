// Operational long-tail articles — pSEO, frontmatter-driven.
//
// Each live state automatically gets the same set of operational articles
// (one per ARTICLE_TOPICS entry), rendered from the state's existing,
// already-vetted frontmatter. There is NO per-state article authoring: add a
// state .mdx, and its articles appear — same "state-as-data" principle as the
// main state page. This keeps every article inside the four hard rules
// (LEGAL_GUARDRAILS.md): the content is informational, derived from the state
// agency's own published facts, links to the .gov template (never drafts it),
// gives no individualized advice, and inherits the site-wide disclaimer/footer
// from BaseLayout.
//
// Topics were chosen from GSC query data (2026-06): the timeline question is
// already ranking ~#7, the how-to pillar targets "how to set up a miller trust"
// (~#86), and the bank-account walkthrough is the unique-content moat.

import type { StateData } from '~/content/config';
import { articleSchema, breadcrumbSchema, howToSchema, faqPageSchemaFromPairs } from '~/lib/schema';
import { REVIEWER } from '~/config/identity';
import { firstSentence } from '~/lib/text';

const SITE_URL = 'https://millertrustguide.com';

// Publish date for the article surface (the day it shipped). dateModified
// tracks the same value; the underlying facts carry their own state.reviewedDate
// which we expose as `lastReviewed` in the Article schema.
const ARTICLE_PUBLISHED = '2026-06-17';

export type ArticleTopic =
  | 'how-to-set-up'
  | 'how-long-to-set-up'
  | 'what-to-say-at-the-bank'
  | 'who-can-be-trustee'
  | 'do-you-need-an-ein'
  | 'what-happens-to-the-money';

// Order matters: this is the order articles appear in "Related guides" lists.
// The last three (T9) are long-tail question doorways, each backed by a single
// already-vetted frontmatter field (trusteeGuidanceNote / einRequiredNote /
// postDeathDistribution) so they add no new legal claim.
export const ARTICLE_TOPICS: ArticleTopic[] = [
  'how-to-set-up',
  'how-long-to-set-up',
  'what-to-say-at-the-bank',
  'who-can-be-trustee',
  'do-you-need-an-ein',
  'what-happens-to-the-money',
];

export interface ArticleMeta {
  topic: ArticleTopic;
  stateSlug: string;
  path: string; // site-relative, e.g. /states/texas/how-to-set-up
  url: string; // absolute canonical
  navLabel: string; // short label for related-guides lists + breadcrumb tail
  h1: string;
  metaTitle: string;
  metaDescription: string;
  primaryQuery: string;
  datePublished: string;
  dateModified: string;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export function articlePath(stateSlug: string, topic: ArticleTopic): string {
  return `/states/${stateSlug}/${topic}`;
}

export function getArticleMeta(state: StateData, topic: ArticleTopic): ArticleMeta {
  const name = state.name;
  const path = articlePath(state.slug, topic);
  const base = {
    topic,
    stateSlug: state.slug,
    path,
    url: `${SITE_URL}${path}`,
    datePublished: ARTICLE_PUBLISHED,
    dateModified: ARTICLE_PUBLISHED,
  };

  switch (topic) {
    case 'how-to-set-up':
      return {
        ...base,
        navLabel: 'How to set one up, step by step',
        h1: `How to Set Up a Miller Trust in ${name}: Step by Step`,
        metaTitle: `How to Set Up a Miller Trust in ${name} (Step by Step)`,
        metaDescription: `A plain-English, step-by-step walkthrough of setting up a Qualified Income Trust (Miller Trust) in ${name} using the official ${state.agencyAbbreviation} template. Informational, not legal advice.`,
        primaryQuery: 'how to set up a miller trust',
      };
    case 'how-long-to-set-up':
      return {
        ...base,
        navLabel: 'How long it takes',
        h1: `How Long Does It Take to Set Up a Miller Trust in ${name}?`,
        metaTitle: `How Long to Set Up a Miller Trust in ${name}? (Timeline)`,
        metaDescription: `How long it takes to set up a ${name} Miller Trust (Qualified Income Trust), the one calendar-month deadline that controls eligibility, and what slows families down. Informational, not legal advice.`,
        primaryQuery: 'how long does it take to set up a miller trust',
      };
    case 'what-to-say-at-the-bank':
      return {
        ...base,
        navLabel: 'What to say at the bank',
        h1: `What to Say at the Bank When Opening a Miller Trust Account in ${name}`,
        metaTitle: `Opening a Miller Trust Bank Account in ${name}: What to Say`,
        metaDescription: `${name} banks routinely refuse Miller Trust (QIT) accounts on the first try. The ${state.bankRefusalNotes.length} most common refusals and exactly what to say to each, with the ${state.agencyAbbreviation} facts behind them. Informational, not legal advice.`,
        primaryQuery: 'miller trust bank account',
      };
    case 'who-can-be-trustee':
      return {
        ...base,
        navLabel: 'Who can be trustee',
        h1: `Who Can Be the Trustee of a Miller Trust in ${name}?`,
        metaTitle: `Who Can Be Trustee of a ${name} Miller Trust?`,
        metaDescription: `Who can serve as trustee of a ${name} Qualified Income Trust (Miller Trust), whether the trustee has to be a lawyer, and what the trustee does each month. Informational, not legal advice.`,
        primaryQuery: 'who can be trustee of a miller trust',
      };
    case 'do-you-need-an-ein':
      return {
        ...base,
        navLabel: 'Do you need an EIN',
        h1: `Do You Need an EIN for a Miller Trust in ${name}?`,
        metaTitle: `Do You Need an EIN for a ${name} Miller Trust?`,
        metaDescription: `Whether a ${name} Miller Trust (Qualified Income Trust) needs its own EIN or uses the beneficiary's Social Security number — and why banks sometimes ask for one anyway. Informational, not legal advice.`,
        primaryQuery: 'do you need an ein for a miller trust',
      };
    case 'what-happens-to-the-money':
      return {
        ...base,
        navLabel: 'What happens to the money',
        h1: `What Happens to a Miller Trust When the Beneficiary Dies in ${name}?`,
        metaTitle: `${name} Miller Trust After Death: What Happens to the Money`,
        metaDescription: `What happens to the money left in a ${name} Miller Trust (Qualified Income Trust) when the beneficiary dies, the state Medicaid payback rule, and why the trust is irrevocable. Informational, not legal advice.`,
        primaryQuery: 'what happens to a miller trust when the person dies',
      };
  }
}

export function getAllArticleMeta(state: StateData): ArticleMeta[] {
  return ARTICLE_TOPICS.map((t) => getArticleMeta(state, t));
}

// Answer-first lede (speakable). First ~80 words must directly answer the
// primary query — GEO / AI-Overview priority, mirrored from StatePageLayout.
export function getArticleLede(state: StateData, topic: ArticleTopic): string {
  const name = state.name;
  const cap = fmt(state.incomeCap2026);
  const pay = `$${fmt(state.privatePayMonthlyLow)}–$${fmt(state.privatePayMonthlyHigh)}`;
  switch (topic) {
    case 'how-to-set-up':
      return `To set up a Miller Trust in ${name}, you complete the official ${state.agencyAbbreviation} Qualified Income Trust template, name a trustee who is not the applicant, open a dedicated trust bank account, and deposit the applicant's income into it in the same calendar month you want coverage to begin. The trust diverts income above ${name}'s $${cap}/month long-term-care Medicaid cap (${state.asOf}) so the applicant qualifies. For the core setup this is a paperwork-and-banking task most families handle themselves; for complex estates, consult a ${name}-licensed elder-law attorney. This guide is informational only and is not legal advice — we explain how to use ${state.agencyAbbreviation}'s own published form; we do not draft it.`;
    case 'how-long-to-set-up':
      return `Setting up a Miller Trust in ${name} is usually a few hours of paperwork plus opening one bank account — but the deadline that controls everything is the calendar month. A ${name} Qualified Income Trust only diverts income in a month where it is signed, has a funded account, and receives enough of the applicant's income to drop countable income below the $${cap}/month cap — all within that same calendar month. ${state.agencyAbbreviation} does not back-date eligibility, so coverage begins the month funding is complete, and every month of delay is another ${pay} of private-pay care. The most common cause of delay is the bank, not the paperwork.`;
    case 'what-to-say-at-the-bank':
      return `When you open a Miller Trust account in ${name}, expect the branch to hesitate — most have never opened a Qualified Income Trust account, and many ask for an attorney or a tax ID (EIN) you do not need. You do not need a lawyer to open the account, and a ${name} QIT is set up using the beneficiary's Social Security number, not an EIN. Below are the ${state.bankRefusalNotes.length} refusals ${name} families hit most often and exactly what to say to each — every response is backed by ${state.agencyAbbreviation}'s own published guidance.`;
    case 'who-can-be-trustee':
      return `In ${name}, the trustee of a Miller Trust (Qualified Income Trust) is whoever manages the trust account — depositing the applicant's income each month and paying out only what ${state.agencyAbbreviation} allows. ${state.trusteeGuidanceNote} The trustee does not have to be a lawyer or a professional; for the core setup this is a role most families fill themselves. For a complex situation, consult a ${name}-licensed elder-law attorney. This guide is informational only and is not legal advice.`;
    case 'do-you-need-an-ein':
      return `${state.einRequiredNote} That is the rule for a ${name} Qualified Income Trust. The question comes up most often at the bank, where staff may ask for an EIN out of habit. Below is what applies in ${name} and what to do if a branch's requirement differs from what ${state.agencyAbbreviation} publishes. This guide is informational only and is not legal or tax advice; for your specific situation, consult a qualified professional.`;
    case 'what-happens-to-the-money':
      return `When the beneficiary of a ${name} Miller Trust dies, money left in the trust does not pass to the family like an ordinary inheritance. ${state.postDeathDistribution} Because most of the applicant's income flows through the trust each month to pay for care, the balance remaining at death is usually small. This guide is informational only and is not legal advice.`;
  }
}

// HowTo steps for the pillar article. Single source of truth: rendered as the
// visible numbered list AND fed to howToSchema so the schema matches the page.
export function getHowToSteps(state: StateData): Array<{ name: string; text: string }> {
  const cap = fmt(state.incomeCap2026);
  const capCouple = fmt(state.incomeCapCouple2026);
  return [
    {
      name: `Confirm the applicant's income is over the ${state.name} cap`,
      text: `A Qualified Income Trust only helps when monthly countable income exceeds ${state.name}'s long-term-care Medicaid limit — $${cap}/month single, $${capCouple}/month for a couple where both apply (${state.asOf}). If income is under the cap, a Miller Trust usually is not needed.`,
    },
    {
      name: `Download the official ${state.agencyAbbreviation} QIT template`,
      text: `Get the model Qualified Income Trust instrument directly from ${state.agencyName} on its .gov site. ${firstSentence(state.officialTemplateNote).lead} We never draft or host the trust text — you use the state's own published form.`,
    },
    {
      name: 'Fill in the fields the template asks for',
      text: `Complete the data fields the ${state.agencyAbbreviation} form requests — the applicant's name, date of birth, Social Security number, and each income source (Social Security, pension, and so on) — following the instructions printed on the template.`,
    },
    {
      name: 'Name a trustee who is not the applicant',
      text: firstSentence(state.trusteeGuidanceNote).lead,
    },
    {
      name: 'Open the dedicated trust bank account',
      text: `Open a dedicated bank account titled to the trust. A ${state.name} QIT is set up with the beneficiary's Social Security number — no EIN is required. Branches commonly hesitate, so know what to say before you go.`,
    },
    {
      name: 'Fund the trust in the same calendar month',
      text: `Deposit enough of the applicant's income into the trust account to bring remaining countable income below $${cap} — in the same calendar month you want coverage to start. ${state.agencyAbbreviation} does not back-date, so the month you fund is the earliest month eligibility can begin.`,
    },
    {
      name: 'Distribute monthly and keep records',
      text: `Each month the trustee pays out only the allowed items (personal-needs allowance, any spousal allowance, medical costs and cost-share) and keeps the named income sources flowing into the account. Staying inside ${state.agencyAbbreviation}'s rules each month is what keeps benefits from being pulled.`,
    },
  ];
}

// A small, topic-specific FAQ set (feeds FAQPage schema + AI Overviews).
function getArticleFaq(state: StateData, topic: ArticleTopic): Array<{ question: string; answer: string }> {
  const cap = fmt(state.incomeCap2026);
  switch (topic) {
    case 'how-long-to-set-up':
      return [
        {
          question: `When does ${state.name} Medicaid coverage start after the Miller Trust is set up?`,
          answer: `Coverage starts the calendar month the QIT is signed, the account is opened, and enough income is deposited to bring countable income below $${cap}/month — all in that same month. ${state.agencyAbbreviation} does not back-date, so there is no retroactive credit for months before the trust was funded.`,
        },
        {
          question: `Can you speed up setting up a ${state.name} Miller Trust?`,
          answer: `The paperwork itself is quick; the usual bottleneck is the bank, because many branches have never opened a Qualified Income Trust account. Knowing the account type, the no-EIN rule, and what to hand the branch up front is what prevents a multi-week delay.`,
        },
      ];
    case 'what-to-say-at-the-bank':
      return [
        {
          question: `Do you need an EIN to open a ${state.name} Miller Trust account?`,
          answer: state.einRequiredNote,
        },
        {
          question: `Do you need a lawyer to open a ${state.name} Miller Trust bank account?`,
          answer: `No. ${state.agencyName} does not require legal representation to open the account. If a branch insists, that is a bank-policy stance, not a Medicaid rule — escalate to the bank's trust department or use a community bank or credit union. For advice on your specific situation, consult a ${state.name}-licensed elder-law attorney.`,
        },
      ];
    case 'how-to-set-up':
      return [];
    case 'who-can-be-trustee':
      return [
        {
          question: `Does the trustee of a ${state.name} Miller Trust have to be a lawyer?`,
          answer: `No. Managing a Qualified Income Trust is an administrative task — opening the dedicated account, depositing the applicant's income each month, and paying out only the amounts ${state.agencyAbbreviation} allows. ${firstSentence(state.trusteeGuidanceNote).lead} For advice on your specific situation, consult a ${state.name}-licensed elder-law attorney.`,
        },
      ];
    case 'do-you-need-an-ein':
      return [
        {
          question: `Do you need an EIN to open a ${state.name} Miller Trust account?`,
          answer: state.einRequiredNote,
        },
      ];
    case 'what-happens-to-the-money':
      return [
        {
          question: `Who gets the money left in a ${state.name} Miller Trust after the beneficiary dies?`,
          answer: state.postDeathDistribution,
        },
      ];
  }
}

// Build the full JSON-LD array for an article page.
export function getArticleJsonLd(state: StateData, topic: ArticleTopic): object[] {
  const meta = getArticleMeta(state, topic);
  const blocks: object[] = [
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'State guides', url: `${SITE_URL}/#states` },
      { name: state.name, url: `${SITE_URL}/states/${state.slug}` },
      { name: meta.navLabel, url: meta.url },
    ]),
    articleSchema({
      headline: meta.h1,
      description: meta.metaDescription,
      url: meta.url,
      datePublished: meta.datePublished,
      dateModified: meta.dateModified,
      lastReviewed: state.reviewedDate,
      reviewedBy: REVIEWER,
      speakableCssSelectors: ['#tldr'],
      citations: [state.officialTemplateUrl, state.policyManualUrl],
    }),
  ];

  if (topic === 'how-to-set-up') {
    blocks.push(
      howToSchema({
        url: meta.url,
        name: meta.h1,
        description: meta.metaDescription,
        steps: getHowToSteps(state).map((s) => ({ name: s.name, text: s.text })),
      })
    );
  }

  const faq = getArticleFaq(state, topic);
  if (faq.length > 0) {
    blocks.push(faqPageSchemaFromPairs(faq));
  }

  return blocks;
}

// Re-export the FAQ builder so the body component can render the same Q&As
// that feed the schema (kept in sync by sourcing from one function).
export { getArticleFaq };
