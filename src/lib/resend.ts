// Resend email wrapper. Handles both:
//   - transactional: the kit-delivery email (sendKitDeliveryEmail)
//   - lifecycle:     the nurture welcome email + audience subscription
//
// One vendor for transactional + audience + broadcast. Domain auth (DKIM,
// SPF, DMARC) is configured in the Resend dashboard against a dedicated
// sending subdomain — see .env.example and the deploy notes.

import { Resend } from 'resend';

let cached: Resend | null = null;

function client(): Resend {
  if (cached) return cached;
  const key = import.meta.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured.');
  cached = new Resend(key);
  return cached;
}

// The Resend SDK resolves with `{ data, error }` and does NOT throw on API
// errors. Our callers (the Stripe webhook, the subscribe endpoint) rely on
// try/catch, so we unwrap here: throw on `error`, return `data` on success.
async function unwrap<T>(p: Promise<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error);
    throw new Error(`Resend API error: ${message}`);
  }
  if (data === null) throw new Error('Resend API returned no data.');
  return data;
}

const FROM_ADDRESS = import.meta.env.RESEND_FROM_ADDRESS || 'support@millertrustguide.com';
const FROM_NAME = import.meta.env.RESEND_FROM_NAME || 'James Whitfield at Miller Trust Guide';
const FROM = `${FROM_NAME} <${FROM_ADDRESS}>`;

const DISCLAIMER_TEXT = `Informational only. This product is not legal advice and is not a substitute for consultation with a licensed attorney. We are not a law firm and we do not practice law. We do not draft legal documents. State Medicaid rules vary and change; verify all information with your state Medicaid agency and an attorney licensed in your state before acting.`;

// ============================================================================
// Transactional — kit delivery (ported from the prior Postmark wrapper)
// ============================================================================

export interface DeliveryEmailParams {
  to: string;
  stateName: string;
  agencyAbbreviation: string;
  downloadUrl: string;
  expiresAt: string;
  orderId: string;
}

export async function sendKitDeliveryEmail(params: DeliveryEmailParams) {
  const expiresHuman = new Date(params.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const textBody = `Hi,

Thank you for purchasing the ${params.stateName} Miller Trust Kit. Your kit is ready to download.

Download link: ${params.downloadUrl}
Link expires: ${expiresHuman}

How to use the kit:
1. Read sections 1-3 first.
2. Complete the funding worksheet in section 4 before you visit the bank.
3. Have the documents listed in section 5 ready before opening the trust account.

Lost the link? Reply to this email and we will resend.

Money-back guarantee: if ${params.agencyAbbreviation} rejects your QIT for any reason traceable to following the kit, reply with the agency's stated denial reason and we issue a full refund within one business day.

Order reference: ${params.orderId}

- James Whitfield
Miller Trust Guide
support@millertrustguide.com

---
${DISCLAIMER_TEXT}
`;

  const htmlBody = `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, system-ui, sans-serif; color: #1F2937; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="font-family: Georgia, serif; color: #0F4C4A;">Your ${params.stateName} Miller Trust Kit</h1>
  <p>Thank you for your purchase. Your kit is ready to download.</p>
  <p style="margin: 24px 0;">
    <a href="${params.downloadUrl}" style="background:#B45309;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Download the kit (PDF)</a>
  </p>
  <p><strong>Link expires:</strong> ${expiresHuman}.</p>
  <h2 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 18px;">How to use the kit</h2>
  <ol>
    <li>Read sections 1-3 first.</li>
    <li>Complete the funding worksheet in section 4 before you visit the bank.</li>
    <li>Have the documents listed in section 5 ready before opening the trust account.</li>
  </ol>
  <p>Lost the link? Reply to this email and we will resend.</p>
  <h2 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 18px;">Money-back guarantee</h2>
  <p>If ${params.agencyAbbreviation} rejects your QIT for any reason traceable to following the kit, reply with the agency's stated denial reason and we issue a full refund within one business day.</p>
  <p style="color: #6B7280; font-size: 13px;">Order reference: ${params.orderId}</p>
  <p style="color: #6B7280; font-size: 13px;">- James Whitfield, Miller Trust Guide, support@millertrustguide.com</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
  <p style="color: #78350F; background:#FEF3C7; padding:12px; border-radius:6px; font-size: 12px;">${DISCLAIMER_TEXT}</p>
</body></html>`;

  return unwrap(
    client().emails.send({
      from: FROM,
      to: params.to,
      replyTo: FROM_ADDRESS,
      subject: `Your ${params.stateName} Miller Trust Kit — download link inside`,
      text: textBody,
      html: htmlBody,
    })
  );
}

// ============================================================================
// Lifecycle — nurture welcome email + audience subscription
// ============================================================================

/**
 * Add an email address to the Resend Audience (the nurture contact list).
 * Idempotent in practice — re-adding an existing contact is harmless.
 * Rule 2: we store the email address only. No name, no state-of-applicant,
 * no income, no family facts. The audience holds email + subscription state.
 */
export async function addSubscriberToAudience(email: string) {
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  if (!audienceId) throw new Error('RESEND_AUDIENCE_ID is not configured.');
  return unwrap(
    client().contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    })
  );
}

/**
 * Send the first nurture email immediately on signup. This is email #1 of
 * the educational series; emails #2+ are sent as Resend Broadcasts to the
 * audience on a schedule (operator-managed in the Resend dashboard).
 *
 * The content is informational only. It gives one genuinely useful insight
 * (the same-calendar-month funding rule), sets expectations for the series,
 * and ends with a soft, no-pressure pointer to the kit. No personalized
 * advice — the email is byte-identical for every subscriber in a state.
 */
export async function sendNurtureWelcomeEmail(email: string, stateName: string) {
  const subject = `The 30-day window most ${stateName} families miss`;

  const textBody = `Hi,

Thanks for joining the Miller Trust Guide email series. Over the next few weeks you'll get a handful of short, plain-English emails about how ${stateName} Miller Trusts actually work — no sales pressure, unsubscribe anytime.

Here's the single most useful thing to know first.

THE FUNDING-MONTH RULE

A Miller Trust (Qualified Income Trust) only does its job for a given month if it is BOTH signed AND funded within that same calendar month. Medicaid does not back-date eligibility to before the trust was working. So if a family signs the trust on the 28th of a month and the bank account isn't funded until the 2nd of the next month, the first month does not qualify — and that month is billed at the private-pay nursing-home rate, often $7,500 to $11,000.

Most families lose a month not because they were ineligible, but because of this timing gap. The fix is simple once you know it: sign early in a month, fund the same day or within a few days, and if income redirects haven't processed yet, manually move that month's income into the trust account before the month ends.

WHAT'S COMING IN THIS SERIES

- What actually happens at the bank when you open a Miller Trust account
- Why most Medicaid denials are paperwork errors, not eligibility problems
- Who can serve as trustee, and what they do each month
- When the situation calls for an attorney instead

If you'd rather not wait for the series, the full ${stateName} Miller Trust Setup Kit walks through every operational step — the bank script, the denial-avoidance checklist, the funding worksheet — for $79, with a money-back guarantee if the state rejects the trust. It's at millertrustguide.com.

No pressure either way. The emails are genuinely useful on their own.

- James Whitfield
Miller Trust Guide
support@millertrustguide.com

To unsubscribe, reply to this email with "unsubscribe" and we'll remove you within one business day.

---
${DISCLAIMER_TEXT}
`;

  const htmlBody = `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, system-ui, sans-serif; color: #1F2937; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 22px;">The 30-day window most ${stateName} families miss</h1>
  <p>Thanks for joining the Miller Trust Guide email series. Over the next few weeks you'll get a handful of short, plain-English emails about how ${stateName} Miller Trusts actually work — no sales pressure, unsubscribe anytime.</p>
  <p>Here's the single most useful thing to know first.</p>

  <h2 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 17px;">The funding-month rule</h2>
  <p>A Miller Trust (Qualified Income Trust) only does its job for a given month if it is <strong>both signed and funded within that same calendar month</strong>. Medicaid does not back-date eligibility to before the trust was working. So if a family signs the trust on the 28th and the bank account isn't funded until the 2nd of the next month, the first month does not qualify — and that month is billed at the private-pay nursing-home rate, often $7,500 to $11,000.</p>
  <p>Most families lose a month not because they were ineligible, but because of this timing gap. The fix is simple once you know it: sign early in a month, fund the same day or within a few days, and if income redirects haven't processed yet, manually move that month's income into the trust account before the month ends.</p>

  <h2 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 17px;">What's coming in this series</h2>
  <ul>
    <li>What actually happens at the bank when you open a Miller Trust account</li>
    <li>Why most Medicaid denials are paperwork errors, not eligibility problems</li>
    <li>Who can serve as trustee, and what they do each month</li>
    <li>When the situation calls for an attorney instead</li>
  </ul>

  <p>If you'd rather not wait for the series, the full ${stateName} Miller Trust Setup Kit walks through every operational step — the bank script, the denial-avoidance checklist, the funding worksheet — for $79, with a money-back guarantee if the state rejects the trust. It's at <a href="https://millertrustguide.com">millertrustguide.com</a>.</p>
  <p>No pressure either way. The emails are genuinely useful on their own.</p>

  <p style="color: #6B7280; font-size: 13px;">- James Whitfield, Miller Trust Guide, support@millertrustguide.com</p>
  <p style="color: #6B7280; font-size: 12px;">To unsubscribe, reply to this email with "unsubscribe" and we'll remove you within one business day.</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
  <p style="color: #78350F; background:#FEF3C7; padding:12px; border-radius:6px; font-size: 12px;">${DISCLAIMER_TEXT}</p>
</body></html>`;

  return unwrap(
    client().emails.send({
      from: FROM,
      to: email,
      replyTo: FROM_ADDRESS,
      subject,
      text: textBody,
      html: htmlBody,
      headers: {
        // RFC 8058 one-click unsubscribe target. Honored manually at MVP volume;
        // ongoing series emails run as Resend Broadcasts which manage this natively.
        'List-Unsubscribe': `<mailto:${FROM_ADDRESS}?subject=unsubscribe>`,
      },
    })
  );
}
