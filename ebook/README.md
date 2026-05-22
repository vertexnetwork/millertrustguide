# Miller Trust Basics — ebook production notes

This directory contains the upload-ready manuscript and cover copy for the
**Miller Trust Basics** ebook — the $9.99 top-of-funnel SKU distributed via
Amazon KDP, Apple Books, Google Play Books, and Kobo. **Distinct from the
$129 Miller Trust Setup Kit** sold at millertrustguide.com.

## Files

| File | Purpose |
|---|---|
| `manuscript.md` | Full body content — front matter + 10 chapters + back matter. Source of truth. |
| `cover-copy.md` | Front, back, and spine copy. Spec for the cover designer. |
| `metadata.md` | KDP upload metadata — title, BISAC, keywords, description, pricing. |

## Doctrine

This ebook **must satisfy all four hard rules in [LEGAL_GUARDRAILS.md](../docs/LEGAL_GUARDRAILS.md)** identically to the kit and the website:

1. **No drafted forms** — references state-published templates by category, never reproduces or hosts trust text.
2. **No personalized intake** — the same 100% of content reaches every reader; no input fields, no decision trees that branch on reader facts.
3. **No email/chat advice** — Amazon/KDP messaging is not used for individual situational advice. The book's CTA routes to the kit and to attorneys, never to "email us your situation."
4. **Disclaimer + informational framing on the cover, on page 1, and at the close of every chapter that touches procedure.**

The product is a Nolo-class informational book about a federal-statute mechanism (42 USC § 1396p(d)(4)(B)). Legal posture is identical to the site.

## What this ebook deliberately does NOT contain

The following operational deliverables are reserved for the $129 kit and must NEVER appear in this ebook:

- The bank-refusal script (verbatim language for the counter)
- The resolution letter for the branch manager
- The five-most-common bank refusals with the response to each
- The monthly funding worksheet (the fillable table)
- The state-by-state denial reasons with the precise policy section behind each
- State-specific Appendix XXXVI / F-6800 / state-handbook citations on operational steps
- The pre-submission checklist (specific line-by-line items)
- Any state-specific operational walkthrough beyond a high-level overview

If a passage would be useful enough that a buyer could skip the $129 kit, it belongs in the kit, not here.

## Conversion to upload formats

### EPUB (Kindle / Apple Books / Google Play / Kobo)

```bash
pandoc manuscript.md \
  --metadata-file metadata.yaml \
  --css ebook.css \
  --epub-cover-image cover-front.jpg \
  -o miller-trust-basics-v1.0.epub
```

KDP accepts EPUB directly. Apple Books and Kobo also accept EPUB. Google Play Books accepts EPUB and PDF.

### DOCX (Kindle alternative)

```bash
pandoc manuscript.md -o miller-trust-basics-v1.0.docx
```

KDP accepts DOCX. Useful if the EPUB conversion needs hand-tuning post-export and Word is the easier editor.

### PDF (KDP Print paperback interior)

```bash
pandoc manuscript.md \
  --pdf-engine=xelatex \
  -V geometry:paperwidth=6in,paperheight=9in,margin=0.75in \
  -V mainfont="Source Serif Pro" \
  -V sansfont="Inter" \
  -V fontsize=10.5pt \
  -o miller-trust-basics-v1.0-interior-6x9.pdf
```

For KDP Print (paperback), generate the cover separately using KDP's cover template (download from KDP based on final page count + paper weight). The paperback is optional — ebook only is fine for v1.

## Versioning

This ebook follows the same versioning scheme as the kit:

- **v1.0** — initial release (2026-05-21)
- Annual update each January after CMS publishes the new Federal Benefit Rate
- Ad-hoc updates when federal statute or CMS guidance changes materially

Past buyers cannot be re-emailed through Amazon (no buyer-list access). Major updates trigger a new edition with a clear "What's New in This Edition" page in the front matter; minor corrections happen silently in-place via KDP's update mechanism.

## Pricing

- **Kindle / Apple Books / Google Play / Kobo:** $9.99 USD
- **KDP 70% royalty tier:** required pricing $2.99–$9.99 → $9.99 nets ~$6.99/sale before delivery fees
- **Apple Books / Google Play / Kobo:** ~70% royalty similar

Net per sale ~$7. Channel is awareness/top-of-funnel, not primary revenue.

## What this ebook is for, strategically

Three jobs:

1. **Discovery.** Rank in Amazon search for "miller trust", "qualified income trust", "medicaid eligibility income", etc. Catch the Persona A search that doesn't reach our site.
2. **Trust signal.** "Available on Amazon" is a credibility marker for our demographic. Reviews on Amazon become social proof we can reference.
3. **Funnel.** The back-matter CTA routes interested readers to the state-specific $129 kit at millertrustguide.com. The ebook teaches *what*; the kit teaches *how* for a specific state.

Conversion target: 5–10% of ebook buyers click through to the kit landing page within 30 days. Of those clicks, expected kit conversion at site-normal rates.
