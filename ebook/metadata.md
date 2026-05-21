# KDP / store metadata — Miller Trust Basics

Drop-in upload metadata for Amazon KDP and the other digital stores. Fields are mapped to KDP's specific field names; equivalents for Apple Books, Google Play, and Kobo noted inline.

---

## Title fields

| Field | Value |
|---|---|
| **Book title** | `Miller Trust Basics` |
| **Subtitle** | `How Income-Cap States Use Qualified Income Trusts to Qualify for Medicaid Long-Term Care` |
| **Series name** | *(leave blank for v1; if you publish state-specific kits later as ebooks, group them under series "Miller Trust Guide")* |
| **Series number** | *(leave blank)* |
| **Edition number** | `1` |

---

## Author fields

| Field | Value |
|---|---|
| **Primary author — first name** | `James` |
| **Primary author — last name** | `Whitfield` |
| **Author title prefix** | *(leave blank — no credentials)* |
| **Contributors** | *(leave blank)* |

**Note on author bio (Author Central):** KDP allows an author bio on Amazon's Author Central. Use this exact text — same as the back cover and the site's About page:

> James Whitfield is the researcher and sole writer of Miller Trust Guide, a research publication that translates state Medicaid policy manuals into plain-English operational guides. He is not an attorney and does not advise on individual situations. Miller Trust Guide is not a law firm and does not practice law.

---

## Description / Marketing Description (back-of-book and Amazon detail page)

KDP allows up to 4,000 characters with basic HTML formatting. Copy the block below verbatim:

```html
<p><b>When Medicaid says no because your parent's income is too high for the cap, a Miller Trust is the way through.</b></p>

<p>Twenty-four U.S. states cap Medicaid long-term-care eligibility at $2,982 per month of income (2026). Most middle-income retirees fall above that cap on Social Security plus a modest pension. Nursing-home care averages $7,500 to $11,000 per month. The income gap that opens between those two numbers is the most common reason families pay out of pocket for months — sometimes years — before Medicaid kicks in.</p>

<p>The Qualified Income Trust, often called a Miller Trust, is the federal-statute mechanism that closes the gap. Properly set up, it diverts the excess income into an irrevocable trust that Medicaid doesn't count, qualifying the applicant for coverage. This book is the plain-English introduction — what a Miller Trust is, how the federal statute behind it works, what the trustee does each month, and what commonly goes wrong.</p>

<p><b>Inside this book:</b></p>
<ul>
  <li>The 2026 income cap and what it actually means for your family</li>
  <li>What a Miller Trust does, in plain English, and why Congress created it</li>
  <li>A decision walkthrough — do you actually need one?</li>
  <li>Who can serve as trustee, what they do each month, and the legal obligations involved</li>
  <li>The three categories of error that cause most Medicaid denials — and how to avoid each</li>
  <li>What happens to the trust when the applicant dies</li>
  <li>When the situation calls for a licensed attorney, and how to find one efficiently</li>
</ul>

<p><b>Who this is for:</b> Adult children, spouses, and family caregivers preparing for or in the middle of a Medicaid long-term-care application in one of the twenty-four U.S. income-cap states. Useful as a standalone introduction or as preparation for an attorney consultation.</p>

<p><i>Informational only. Not legal advice. Miller Trust Guide is not a law firm and does not practice law.</i></p>
```

---

## Categories (BISAC)

KDP allows up to 3 categories on Kindle ebooks and up to 2 BISAC codes on KDP Print paperbacks. Pick from these:

| BISAC code | Category path | Priority |
|---|---|---|
| `LAW018000` | LAW / Elder Law | **Primary** |
| `LAW086000` | LAW / Estates & Trusts | Secondary |
| `SOC036000` | SOCIAL SCIENCE / Disability Studies (Aging) | Tertiary |
| `REF021000` | REFERENCE / Personal & Practical Guides | Alternate if KDP rejects primary |

**KDP submission strategy:** request the *Kindle Store > Books > Health, Family & Lifestyle > Aging Parents* category and the *Kindle Store > Books > Law > Estates & Trusts* category via KDP's "category change request" flow after the book is live. These specific subcategories are more discoverable than the parent BISAC categories but require manual request.

**For Apple Books / Google Play / Kobo:** map LAW018000 to those stores' equivalent categories (typically "Reference & Information / Legal Reference" or "Self-help / Legal").

---

## Keywords (7 max for Kindle)

KDP allows 7 keyword strings, each up to 50 characters. Lead with high-intent search phrases:

1. `miller trust`
2. `qualified income trust`
3. `medicaid eligibility income cap`
4. `nursing home medicaid`
5. `elder law guide`
6. `long-term care planning`
7. `medicaid for parents`

**Notes on keyword tuning:**

- Keywords are matched against Amazon's search index, not displayed to the buyer.
- Don't waste a slot on the book's title or subtitle — Amazon already indexes those.
- Don't keyword-stuff (Amazon will reject).
- Re-tune keywords quarterly based on Amazon search-term reports if revenue justifies it.

---

## Language and audience

| Field | Value |
|---|---|
| **Primary language** | `English` |
| **Audience** | `Adult` |
| **Age range** | *(leave blank)* |
| **Grade range** | *(leave blank)* |

---

## Pricing

### Ebook pricing (all stores)

| Store | Price | Royalty tier |
|---|---|---|
| **Amazon Kindle** | `$9.99 USD` | 70% (eligible at $2.99–$9.99) |
| **Apple Books** | `$9.99 USD` | ~70% standard |
| **Google Play Books** | `$9.99 USD` | ~70% standard (Google Play sets list price; pay-out is ~70%) |
| **Kobo** | `$9.99 USD` | ~70% standard |

### International pricing

Use KDP's "Set prices based on US price" auto-conversion for v1. Tune per-territory manually later if any market shows outsized demand.

### KDP Select / Kindle Unlimited

**Decision: do NOT enroll in KDP Select for v1.**

Reasoning: KDP Select requires Amazon exclusivity for 90 days (no other store can sell the ebook). The strategic value of this book is *discovery across stores* — Apple Books, Google Play, and Kobo each have meaningful elder-demographic readership. KDP Select's marketing benefits (free promotion days, Kindle Unlimited inclusion) are unlikely to outperform the cross-store distribution loss for a niche reference title.

Revisit at v2 if Amazon-specific sales materially exceed cross-store sales.

### Paperback pricing (optional, KDP Print)

If publishing a paperback:

| Field | Value |
|---|---|
| **Trim size** | `6 × 9 inches` |
| **Interior type** | Black & white on white paper |
| **List price (US)** | `$14.99 USD` |
| **Expanded distribution** | Yes (allows IngramSpark distribution to bookstores; reduces royalty per copy) |

Paperback royalty is meaningfully lower than ebook (you pay print + distribution per copy). Net per paperback at $14.99 with expanded distribution: roughly $1.50–2.50 depending on final page count. The paperback is a credibility play (reviewers and journalists prefer paperback review copies), not a revenue play.

---

## DRM

**Decision: DRM off ("Do not enable DRM").**

Reasoning: DRM costs are real (it complicates the buyer's reading experience across devices and triggers a meaningful negative-review pattern in the elder demographic), the protective value is nominal (a determined pirate breaks Amazon DRM in minutes; DRM stops only honest buyers from format-shifting their own purchase), and the brand posture of the publication ("we trust you") matches the no-DRM choice.

---

## Publication date

| Field | Value |
|---|---|
| **Publication date** | `2026-05-21` (or set to your actual upload date) |
| **Original publication date** | Same as publication date for v1 |

---

## Print rights / ISBN

| Field | Value |
|---|---|
| **ISBN (ebook)** | `[KDP-assigned ASIN]` *(KDP auto-issues; you don't need to purchase one for Kindle)* |
| **ISBN (paperback, KDP Print)** | `[KDP-assigned ISBN]` *(KDP offers a free ISBN for paperback; sufficient for KDP Print and Amazon listing)* |
| **ISBN (paperback, wider distribution)** | `[Bowker-purchased, $125]` *(required if you want IngramSpark or non-Amazon retail distribution beyond KDP's Expanded Distribution)* |

---

## Territory rights

| Field | Value |
|---|---|
| **Territory** | `Worldwide` (KDP), worldwide for all other stores. |
| **Public domain status** | `No` |
| **Translation rights** | Reserved (don't grant translation rights at v1; revisit if a non-English market shows demand) |

---

## Tax interview (KDP-specific)

KDP requires a US tax interview to set up payments. Complete it before submitting the book. Forms: W-9 (US person) or W-8BEN (non-US). Payment threshold: $10 by check, $1 by EFT.

---

## Author Central setup (post-launch)

After the book is live on Amazon, set up Author Central at author.amazon.com:

- Author photo: **leave blank** (per the publication's anonymity posture — no photo)
- Author bio: copy from the back cover
- Twitter / social: **leave blank**
- Author website: `https://millertrustguide.com`
- Editorial reviews: drop in any 3rd-party reviews as they come in

---

## Pre-launch checklist

Before clicking "Publish" on KDP, verify:

- [ ] Manuscript file converted (EPUB or DOCX) and previewed in Kindle Previewer
- [ ] Front cover image meets KDP specs (1600 × 2560 px, RGB, JPG or TIFF)
- [ ] Title, subtitle, author, description, BISAC, keywords entered correctly
- [ ] Pricing and royalty tier confirmed
- [ ] KDP Select enrollment NOT selected
- [ ] DRM NOT enabled
- [ ] Tax interview completed
- [ ] Author Central account set up (can do post-publish, but easier to do at launch)
- [ ] Disclaimer page is page 1 of the manuscript and matches the back-cover disclaimer line
- [ ] No drafted trust template, no personalized intake, no advice-on-specific-situations content (the four hard rules from LEGAL_GUARDRAILS.md verified)
- [ ] The CTA in Chapter 10 and the "About the Setup Kit" back-matter section point to millertrustguide.com (not to any specific kit URL — kit URLs may change; the home page is stable)
- [ ] The 2026 income figures cited throughout match the current CMS Federal Benefit Rate

---

## Post-launch (week 1)

- Verify the book appears in Amazon search for "miller trust" within 24 hours of going live
- Request category placement upgrades via KDP's category-change-request flow (see Categories section above)
- Tweet — *kidding, anonymity doctrine forbids social*. Instead: add a short sidebar mention of the book to the millertrustguide.com home page footer ("Available on Amazon, Apple Books, Google Play, and Kobo")
- Buy one author copy via KDP Print (if paperback is published) to confirm print quality
- Monitor KDP Reports dashboard daily for the first week; weekly thereafter

---

## Post-launch (month 1)

- Submit to relevant elder-law and family-caregiver review outlets:
  - *ElderLawAnswers* (free article submission, may pick up the book for an editorial mention)
  - *Caring.com*
  - *AARP Now* (long shot but free to pitch)
  - *NextAvenue.org* (PBS-affiliated; covers aging-policy issues)
- Request reviews from buyers via Amazon's standard "request a review" mechanism (one click per buyer; Amazon throttles to prevent abuse)
- Monitor Amazon search-term reports; tune keywords at month-end if any are clearly underperforming

---

## v2 trigger

Plan a v2 update by **2027-02-15** at the latest — gives one month buffer after CMS publishes 2027 figures (typically December 2026 or January 2027) to update the book and re-upload. Earlier triggers:

- Material federal statutory or regulatory change affecting QITs
- A reader-reported error that materially affects the substance of the book
- A noticeable accumulation of minor corrections (5+ small fixes) — bundle them into a v1.1 micro-update
