# Miller Trust Guide

State-specific operational guides for using publicly-published Qualified Income Trust (Miller Trust) templates to qualify a family member for Medicaid long-term care.

> **Informational only. Not legal advice. Not a law firm.**

## Stack

- **Astro 5** (server output, Vercel adapter) — content-collections-first, ships zero JS by default
- **Tailwind CSS** — design tokens locked to teal-led palette
- **Stripe Checkout** + **Stripe Tax** — payment + automated US sales-tax calculation
- **Vercel Blob** — private kit PDF storage with 7-day signed-URL delivery
- **Postmark** — transactional kit-delivery email
- **Vercel** (Hobby) hosting

## Project layout

```
src/
├── content/
│   ├── config.ts                 Zod schema for state collection (the contract)
│   └── states/
│       └── texas.mdx             State #1 (data-only; rendering lives in layout)
├── components/
│   ├── DisclaimerBanner.astro    Rule 4 — every page
│   ├── ConsentBuyButton.astro    Rule 4 — consent gate + Stripe Checkout init
│   ├── ComparisonTable.astro
│   ├── ReassuranceBlock.astro
│   ├── MoneyBackGuarantee.astro
│   ├── PdfPreview.astro
│   └── Footer.astro              Rule 4 — full disclaimer block
├── layouts/
│   ├── BaseLayout.astro          Site-wide chrome (disclaimer, footer, JSON-LD)
│   └── StatePageLayout.astro     Reads state schema → renders conversion surface
├── lib/
│   ├── stripe.ts
│   ├── blob.ts                   Vercel Blob signed-URL helper
│   ├── postmark.ts               Kit-delivery email template
│   └── schema.ts                 JSON-LD generators (Organization / Article / FAQPage)
└── pages/
    ├── index.astro
    ├── about.astro
    ├── disclaimer.astro
    ├── privacy.astro
    ├── refund-policy.astro
    ├── thanks.astro              SSR — verifies Stripe payment status
    ├── states/[slug].astro       Static state pages, generated from collection
    └── api/
        ├── create-checkout.ts    Rule 4 server-side consent gate → Stripe session
        └── stripe-webhook.ts     Signature verify → signed URL → Postmark delivery

scripts/check-guardrails.mjs      CI gate: Rules 1, 2, 3 enforced as regex checks
.github/workflows/guardrails.yml  Runs guardrails + type-check on every PR
```

## The four hard rules — encoded as code

| Rule | Where enforced |
|---|---|
| **1. No drafted forms** | `scripts/check-guardrails.mjs` rejects forbidden trust-instrument prose in MDX. State files require `officialTemplateUrl` on `.gov`/`.us`. |
| **2. No personalized intake** | Guardrail script rejects PII-named form fields. Only one form exists (email-only lead magnet). |
| **3. No email/chat advice** | Guardrail rejects live-chat vendor scripts and US phone numbers. Postmark templates carry only sanctioned canned replies. |
| **4. Disclaimer + consent** | `DisclaimerBanner` site-wide; `ConsentBuyButton` client-disables until checkbox is checked; `/api/create-checkout` rejects POSTs missing `consent: true`; Stripe metadata mirrors the consent record. |

## Local development

```sh
# 1. Install
npm install

# 2. Configure secrets
cp .env.example .env
# Fill in Stripe TEST keys, Postmark token, Vercel Blob token.

# 3. Run dev server
npm run dev          # http://localhost:4321

# 4. Run guardrail checks before commit
npm run lint:guardrails

# 5. Type-check
npm run check
```

### Stripe webhook (local)

```sh
# Forward live Stripe events to local dev server:
stripe listen --forward-to localhost:4321/api/stripe-webhook
# Copy the printed `whsec_...` into STRIPE_WEBHOOK_SECRET in .env.
```

## Production deploy (Vercel)

1. Connect the repo to Vercel (Hobby tier).
2. Add `millertrustguide.com` to the project; copy DNS into Namecheap.
3. Set environment variables in Vercel for **Production** + **Preview**:
   - `STRIPE_SECRET_KEY` (LIVE in production, TEST in preview)
   - `STRIPE_WEBHOOK_SECRET`
   - `POSTMARK_SERVER_TOKEN`
   - `POSTMARK_FROM_ADDRESS=support@millertrustguide.com`
   - `POSTMARK_FROM_NAME="James Whitfield at Miller Trust Guide"`
   - `BLOB_READ_WRITE_TOKEN` (Vercel Blob → create store → copy token)
   - `SITE_URL=https://millertrustguide.com`
4. In the Stripe dashboard, add webhook endpoint:
   - URL: `https://millertrustguide.com/api/stripe-webhook`
   - Events: `checkout.session.completed`
   - Paste the resulting `whsec_...` into Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Upload kit PDFs to Vercel Blob at the canonical key (e.g. `kits/texas/v1.pdf`).
6. In Stripe, create a Product + Price for each live state (`$79` one-time, USD).
   Paste the Price ID into the state's frontmatter (`stripePriceId`).
7. Push to `main` — Vercel deploys automatically.

## Adding a new state

The architecture is "state-as-data." Adding state #N is:

1. Author `src/content/states/{state-slug}.mdx` following the Zod schema in `src/content/config.ts`.
2. Author the kit PDF using the master template; upload to Vercel Blob at `kits/{state-slug}/v1.pdf`.
3. Create a Stripe Product + Price; paste the Price ID into the state's frontmatter.
4. Run `npm run lint:guardrails` and `npm run check`.
5. Commit, push — Vercel builds the new `/states/{state-slug}` route automatically.

**No template changes. No route additions. Adding a state must remain a data drop.**

## Repo visibility

This repo is **public** to qualify for Vercel's Hobby tier. Operator-private docs (PLAN, doctrine, persona research, competitor analysis, UPL defense playbook) live in `/docs/` and `PLAN.md` and are gitignored — they never leave the operator's workstation.

If you cloned this and want to contribute, note that the operational doctrine driving editorial choices is intentionally not published.
