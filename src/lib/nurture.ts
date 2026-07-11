// The nurture email series.
//
// Five emails, all informational (Rule 3 — no individualized advice, no UPL
// surface). Email 1 goes out immediately on signup (from /api/subscribe);
// emails 2-5 are dripped by the daily cron at /api/cron/nurture, which uses
// each contact's signup date to decide which email is due.
//
// Pacing — measured in days since signup:
//   #1  day 0   (welcome — sent transactionally at signup)
//   #2  day 3
//   #3  day 8
//   #4  day 14
//   #5  day 21
// Front-loaded, then easing off — keeps the brand present across the
// 1-6 week buying window without fatiguing the reader.

import { sendEmail, DISCLAIMER_TEXT } from '~/lib/resend';

// Drip schedule for the cron. Email 1 is intentionally absent — it is sent
// at signup, not by the cron. `day` is the integer days-since-signup on
// which the cron sends `emailNumber`.
export const NURTURE_SCHEDULE: { emailNumber: number; day: number }[] = [
  { emailNumber: 2, day: 3 },
  { emailNumber: 3, day: 8 },
  { emailNumber: 4, day: 14 },
  { emailNumber: 5, day: 21 },
];

interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

// Shared footer — sign-off, unsubscribe (CAN-SPAM), and the Rule-4 disclaimer.
const SIGNOFF_TEXT = `- James Whitfield
Miller Trust Guide
support@millertrustguide.com

To unsubscribe, reply to this email with "unsubscribe" and we'll remove you within one business day.

---
${DISCLAIMER_TEXT}`;

const SIGNOFF_HTML = `  <p style="color: #6B7280; font-size: 13px;">- James Whitfield, Miller Trust Guide, support@millertrustguide.com</p>
  <p style="color: #6B7280; font-size: 12px;">To unsubscribe, reply to this email with "unsubscribe" and we'll remove you within one business day.</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
  <p style="color: #78350F; background:#FEF3C7; padding:12px; border-radius:6px; font-size: 12px;">${DISCLAIMER_TEXT}</p>`;

const SITE = 'https://millertrustguide.com';

// Deep-link a lead back to the page they came from when we know it (email 1,
// where the state is known at signup), otherwise the homepage.
function stateUrl(slug?: string): string {
  return slug ? `${SITE}/states/${slug}` : SITE;
}

// Styled button CTA — matches the kit-delivery email's button so the series
// has a real call-to-action instead of a bare inline link.
function ctaButton(href: string, label: string): string {
  return `  <p style="margin:24px 0;"><a href="${href}" style="background:#B45309;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${label}</a></p>`;
}

// One-line guarantee, reused across the series to de-risk the click.
const GUARANTEE_LINE =
  'Every kit is backed by a money-back guarantee — if the state rejects the trust for a reason traceable to following the kit, you get a full refund.';

/** Wrap an HTML body fragment in the standard email shell. */
function htmlShell(headingText: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, system-ui, sans-serif; color: #1F2937; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 22px;">${headingText}</h1>
${bodyHtml}
${SIGNOFF_HTML}
</body></html>`;
}

// ============================================================================
// Email 1 — Welcome (day 0, sent at signup). State-specific.
// ============================================================================

interface Email1Ctx {
  slug?: string;
  privatePayLow?: number;
  privatePayHigh?: number;
}

function email1(stateName: string, ctx: Email1Ctx = {}): EmailContent {
  const url = stateUrl(ctx.slug);
  // State-specific private-pay range when we have it, so the figure here can
  // never contradict the state page or the kit. Falls back to a safe generic.
  const payPhrase =
    ctx.privatePayLow && ctx.privatePayHigh
      ? `often $${ctx.privatePayLow.toLocaleString('en-US')} to $${ctx.privatePayHigh.toLocaleString('en-US')}`
      : 'often many thousands of dollars';

  // The checklist the capture form promised — the tangible lead magnet. Only
  // present when we know the state (always true at signup from a state page).
  const checklistUrl = ctx.slug ? `${SITE}/checklist/${ctx.slug}` : '';
  const checklistText = checklistUrl
    ? `

Here's the free ${stateName} denial-trap checklist you asked for:
${checklistUrl}

It's one page — the most common reasons ${stateName} Medicaid denies a Miller Trust, each with the state-agency citation behind it. Save or print it before you visit the bank.`
    : '';
  const checklistHtml = checklistUrl
    ? `  <p>Here's the free ${stateName} denial-trap checklist you asked for — one page: the most common reasons ${stateName} Medicaid denies a Miller Trust, each with the state-agency citation behind it. Save or print it before you visit the bank.</p>
${ctaButton(checklistUrl, `Open your ${stateName} checklist`)}`
    : '';

  const subject = checklistUrl
    ? `Your ${stateName} Miller Trust checklist is inside`
    : `The 30-day window most ${stateName} families miss`;
  const text = `Hi,

Thanks for joining the Miller Trust Guide email series.${checklistText}

Over the next three weeks you'll get four more short, plain-English emails about how ${stateName} Miller Trusts actually work — no sales pressure, unsubscribe anytime.

Here's the single most useful thing to know first.

THE FUNDING-MONTH RULE

A Miller Trust (Qualified Income Trust) only does its job for a given month if it is BOTH signed AND funded within that same calendar month. Medicaid does not back-date eligibility to before the trust was working. So if a family signs the trust on the 28th of a month and the bank account isn't funded until the 2nd of the next month, the first month does not qualify — and that month is billed at the private-pay nursing-home rate, ${payPhrase} a month.

Most families lose a month not because they were ineligible, but because of this timing gap. The fix is simple once you know it: sign early in a month, fund the same day or within a few days, and if income redirects haven't processed yet, manually move that month's income into the trust account before the month ends.

WHAT'S COMING IN THIS SERIES

- What actually happens at the bank when you open a Miller Trust account
- Why most Medicaid denials are paperwork errors, not eligibility problems
- Who can serve as trustee, and what they do each month
- When the situation calls for an attorney instead

If you'd rather not wait, the full ${stateName} Miller Trust Setup Kit walks through every operational step — the bank script, the denial-avoidance checklist, the funding worksheet. ${GUARANTEE_LINE}

See the ${stateName} kit: ${url}

No pressure either way. The emails are genuinely useful on their own.

${SIGNOFF_TEXT}`;

  const html = htmlShell(
    `The 30-day window most ${stateName} families miss`,
    `  <p>Thanks for joining the Miller Trust Guide email series.</p>
${checklistHtml}
  <p>Over the next three weeks you'll get four more short, plain-English emails about how ${stateName} Miller Trusts actually work — no sales pressure, unsubscribe anytime.</p>
  <p>Here's the single most useful thing to know first.</p>
  <h2 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 17px;">The funding-month rule</h2>
  <p>A Miller Trust (Qualified Income Trust) only does its job for a given month if it is <strong>both signed and funded within that same calendar month</strong>. Medicaid does not back-date eligibility to before the trust was working. So if a family signs the trust on the 28th and the bank account isn't funded until the 2nd of the next month, the first month does not qualify — and that month is billed at the private-pay nursing-home rate, ${payPhrase} a month.</p>
  <p>Most families lose a month not because they were ineligible, but because of this timing gap. The fix is simple once you know it: sign early in a month, fund the same day or within a few days, and if income redirects haven't processed yet, manually move that month's income into the trust account before the month ends.</p>
  <h2 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 17px;">What's coming in this series</h2>
  <ul>
    <li>What actually happens at the bank when you open a Miller Trust account</li>
    <li>Why most Medicaid denials are paperwork errors, not eligibility problems</li>
    <li>Who can serve as trustee, and what they do each month</li>
    <li>When the situation calls for an attorney instead</li>
  </ul>
  <p>If you'd rather not wait, the full ${stateName} Miller Trust Setup Kit walks through every operational step — the bank script, the denial-avoidance checklist, the funding worksheet. ${GUARANTEE_LINE}</p>
${ctaButton(url, `See the ${stateName} kit`)}
  <p style="color:#6B7280;font-size:13px;">No pressure either way — the emails are genuinely useful on their own.</p>`
  );

  return { subject, text, html };
}

// ============================================================================
// Email 2 — The bank step (day 3). Generic (cron has no per-contact state).
// ============================================================================

function email2(): EmailContent {
  const subject = 'What actually happens at the bank';
  const text = `Hi,

The single place families get stuck setting up a Miller Trust is not the trust document — it's the bank.

Here's the reality. When you take the signed trust in to open the account, the first visit is usually refused. Not because anything is wrong with your trust. Most branch staff have simply never opened a Qualified Income Trust account — it isn't one of the account types on their screen. So they improvise: they ask for an EIN you don't need, or say you have to bring a lawyer, or tell you their system has no option for this kind of account.

None of that is a Medicaid rule. It's a gap in the branch's training. And it's fixable.

The families who get the account open on the first or second try are the ones who walk in knowing three things: the exact account they're asking for, the specific state policy section that authorizes it, and what to say when the branch pushes back. The families who don't can lose weeks going back and forth — and weeks matter, because of the funding-month rule from the last email.

The kit's bank section is built entirely around this: a word-for-word script for the counter, the five most common refusals with the response to each, and a one-page letter you can hand the branch manager to escalate inside their own bank. It's the part buyers most often tell other families about.

${GUARANTEE_LINE}

See the kits: ${SITE}

${SIGNOFF_TEXT}`;

  const html = htmlShell(
    'What actually happens at the bank',
    `  <p>The single place families get stuck setting up a Miller Trust is not the trust document — it's the bank.</p>
  <p>Here's the reality. When you take the signed trust in to open the account, the first visit is usually refused. Not because anything is wrong with your trust. Most branch staff have simply never opened a Qualified Income Trust account — it isn't one of the account types on their screen. So they improvise: they ask for an EIN you don't need, or say you have to bring a lawyer, or tell you their system has no option for this kind of account.</p>
  <p><strong>None of that is a Medicaid rule.</strong> It's a gap in the branch's training. And it's fixable.</p>
  <p>The families who get the account open on the first or second try are the ones who walk in knowing three things: the exact account they're asking for, the specific state policy section that authorizes it, and what to say when the branch pushes back. The families who don't can lose weeks going back and forth — and weeks matter, because of the funding-month rule from the last email.</p>
  <p>The kit's bank section is built entirely around this: a word-for-word script for the counter, the five most common refusals with the response to each, and a one-page letter you can hand the branch manager to escalate inside their own bank. It's the part buyers most often tell other families about. ${GUARANTEE_LINE}</p>
${ctaButton(SITE, 'See the kits')}`
  );

  return { subject, text, html };
}

// ============================================================================
// Email 3 — Denials are paperwork, not eligibility (day 8).
// ============================================================================

function email3(): EmailContent {
  const subject = 'Most denials are paperwork, not eligibility';
  const text = `Hi,

Something reassuring, because the word "denial" frightens families more than it should.

When a Qualified Income Trust gets denied, it is almost never because the family member didn't qualify. It's because of a fixable process error. The most common ones:

- The trust was signed in one calendar month and funded in the next.
- An out-of-date template was used instead of the state's current one.
- The reversion clause — the part naming the state — was altered or removed.
- A required distribution went out late, after the deadline.
- Money that wasn't the applicant's listed income got deposited into the account.

Notice what is NOT on that list: "your family member earns too much" or "they don't need this level of care." Genuine eligibility is rarely the thing that fails.

The practical takeaway: if your family member's income is over the limit and they need long-term care, the QIT path almost certainly works. What determines whether it goes smoothly is getting the mechanical steps right, and in the right order — not luck, and not whether the state likes your application.

The kit lists every common denial reason for your state with the exact policy citation behind it, plus a checklist to run the day before you file. That checklist exists for one reason: to catch a paperwork error while it's still free to fix, instead of after the denial letter arrives.

${GUARANTEE_LINE}

See the kits: ${SITE}

${SIGNOFF_TEXT}`;

  const html = htmlShell(
    'Most denials are paperwork, not eligibility',
    `  <p>Something reassuring, because the word "denial" frightens families more than it should.</p>
  <p>When a Qualified Income Trust gets denied, it is almost never because the family member didn't qualify. It's because of a fixable process error. The most common ones:</p>
  <ul>
    <li>The trust was signed in one calendar month and funded in the next.</li>
    <li>An out-of-date template was used instead of the state's current one.</li>
    <li>The reversion clause — the part naming the state — was altered or removed.</li>
    <li>A required distribution went out late, after the deadline.</li>
    <li>Money that wasn't the applicant's listed income got deposited into the account.</li>
  </ul>
  <p>Notice what is <em>not</em> on that list: "your family member earns too much" or "they don't need this level of care." Genuine eligibility is rarely the thing that fails.</p>
  <p>The practical takeaway: if your family member's income is over the limit and they need long-term care, the QIT path almost certainly works. What determines whether it goes smoothly is getting the mechanical steps right, and in the right order.</p>
  <p>The kit lists every common denial reason for your state with the exact policy citation behind it, plus a checklist to run the day before you file — to catch a paperwork error while it's still free to fix. ${GUARANTEE_LINE}</p>
${ctaButton(SITE, 'See the kits')}`
  );

  return { subject, text, html };
}

// ============================================================================
// Email 4 — The trustee role (day 14).
// ============================================================================

function email4(): EmailContent {
  const subject = 'Who manages the trust — and what it takes';
  const text = `Hi,

A question that worries families more than it should: "once this trust exists, who actually runs it?"

The trust needs a trustee — the person who manages the trust's bank account. In most families it's an adult child who already holds financial power of attorney for the parent. Sometimes it's the spouse who is staying at home. It does not have to be a lawyer or a professional.

The job is real but modest. Once the account is open and the income is redirected, it is roughly an hour or two a month:

- Confirm the month's income landed in the trust account.
- Make the required distributions — the personal needs allowance, any spousal amount, and the share-of-cost payment to the care facility.
- File the statement.

There is exactly one rule that matters: it has to happen every month, on time. A missed month is a denied month of coverage. So the trustee's real job is not complexity — it's reliability. Most families set a recurring monthly reminder and treat it like paying a utility bill.

It is a routine, not a burden. But it is a routine someone has to own, and it's worth deciding who that person is before the trust is set up rather than after.

The kit walks the trustee through the monthly rhythm step by step, and includes a record-keeping checklist so that if the state ever asks for documentation, it's already in one place.

${GUARANTEE_LINE}

See the kits: ${SITE}

${SIGNOFF_TEXT}`;

  const html = htmlShell(
    'Who manages the trust — and what it takes',
    `  <p>A question that worries families more than it should: "once this trust exists, who actually runs it?"</p>
  <p>The trust needs a trustee — the person who manages the trust's bank account. In most families it's an adult child who already holds financial power of attorney for the parent. Sometimes it's the spouse who is staying at home. It does not have to be a lawyer or a professional.</p>
  <p>The job is real but modest. Once the account is open and the income is redirected, it is roughly an hour or two a month:</p>
  <ul>
    <li>Confirm the month's income landed in the trust account.</li>
    <li>Make the required distributions — the personal needs allowance, any spousal amount, and the share-of-cost payment to the care facility.</li>
    <li>File the statement.</li>
  </ul>
  <p>There is exactly one rule that matters: it has to happen <strong>every month, on time</strong>. A missed month is a denied month of coverage. So the trustee's real job is not complexity — it's reliability. Most families set a recurring monthly reminder and treat it like paying a utility bill.</p>
  <p>It is a routine, not a burden — but a routine someone has to own. The kit walks the trustee through the monthly rhythm and includes a record-keeping checklist. ${GUARANTEE_LINE}</p>
${ctaButton(SITE, 'See the kits')}`
  );

  return { subject, text, html };
}

// ============================================================================
// Email 5 — When to call an attorney (day 21). The honest close.
// ============================================================================

function email5(): EmailContent {
  const subject = 'When to bring in an attorney';
  const text = `Hi,

These emails have focused on what families can do themselves. Here's the honest other side — because doing this well means knowing where the line is.

A Miller Trust for a straightforward income situation is well within do-it-yourself range. It is a defined process built on the state's own template. But some situations genuinely call for an elder-law attorney, not a guide:

- The applicant has other trusts — a living trust, a special needs trust, an asset-protection trust.
- Assets were given away or transferred for less than fair value in the last five years.
- There are significant countable assets that need to be planned around, not just income.
- It's a married couple with one spouse staying home — the resource-allowance rules that protect the at-home spouse are fact-specific.
- A Medicaid application was already denied for a substantive reason.

If any of those describe your situation, an attorney is the right call — and that is not a failure of the do-it-yourself approach. It's just matching the tool to the job. Plenty of families use a guide for the trust itself and an attorney for the one genuinely complex piece.

If your situation is the straightforward kind — income over the limit, a clear need for care, no tangled assets — then a kit is very likely all you need.

Either way, you now know enough to tell which situation you're in. That was the point of these emails. The kit's final section spells out exactly when to involve an attorney and how to find the right one; the rest of it handles everything else.

Thank you for reading. If a kit would help, the money-back guarantee means the only real risk is bounded.

See the kits: ${SITE}

${SIGNOFF_TEXT}`;

  const html = htmlShell(
    'When to bring in an attorney',
    `  <p>These emails have focused on what families can do themselves. Here's the honest other side — because doing this well means knowing where the line is.</p>
  <p>A Miller Trust for a straightforward income situation is well within do-it-yourself range. But some situations genuinely call for an elder-law attorney, not a guide:</p>
  <ul>
    <li>The applicant has other trusts — a living trust, a special needs trust, an asset-protection trust.</li>
    <li>Assets were given away or transferred for less than fair value in the last five years.</li>
    <li>There are significant countable assets that need planning around, not just income.</li>
    <li>It's a married couple with one spouse staying home — the resource-allowance rules are fact-specific.</li>
    <li>A Medicaid application was already denied for a substantive reason.</li>
  </ul>
  <p>If any of those describe your situation, an attorney is the right call — and that is not a failure of the do-it-yourself approach. It's matching the tool to the job. Plenty of families use a guide for the trust and an attorney for the one genuinely complex piece.</p>
  <p>If your situation is the straightforward kind — income over the limit, a clear need for care, no tangled assets — a kit is very likely all you need. Either way, you now know enough to tell which situation you're in.</p>
  <p>Thank you for reading. If a kit would help, the money-back guarantee means the only real risk is bounded.</p>
${ctaButton(SITE, 'See the kits')}`
  );

  return { subject, text, html };
}

/**
 * Build the content for nurture email N. stateName is only used by email 1
 * (the welcome, sent at signup where the state is known); emails 2-5 are
 * state-generic because the drip cron has no per-contact state.
 */
function nurtureEmailContent(
  emailNumber: number,
  stateName: string,
  ctx: Email1Ctx = {}
): EmailContent {
  switch (emailNumber) {
    case 1:
      return email1(stateName, ctx);
    case 2:
      return email2();
    case 3:
      return email3();
    case 4:
      return email4();
    case 5:
      return email5();
    default:
      throw new Error(`No nurture email defined for number ${emailNumber}`);
  }
}

/**
 * Send nurture email N to a subscriber. Email 1 is sent at signup;
 * emails 2-5 are sent by the daily drip cron.
 */
export async function sendNurtureEmail(
  emailNumber: number,
  to: string,
  stateName = 'your state',
  ctx: Email1Ctx = {}
) {
  const content = nurtureEmailContent(emailNumber, stateName, ctx);
  return sendEmail({ to, ...content });
}
