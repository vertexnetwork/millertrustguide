// Resend email wrapper. Handles both:
//   - transactional: the kit-delivery email (sendKitDeliveryEmail)
//   - lifecycle:     the nurture welcome email + audience subscription
//
// One vendor for transactional + audience + broadcast. Domain auth (DKIM,
// SPF, DMARC) is configured in the Resend dashboard against a dedicated
// sending subdomain — see .env.example and the deploy notes.

import { Resend } from 'resend';
import { createUnsubscribeToken } from '~/lib/unsubscribe-token';

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
// Operational — webhook-failure alert
// ============================================================================
//
// Fires to the operator whenever a PAID order fails to deliver, so a
// paid-but-undelivered checkout can never again fail silently (this bug was
// found from a screenshot, not an alert). Best-effort: never throws — if
// Resend itself is the failure, we log and move on so the alert path can't
// mask the original webhook error.

export async function sendOperatorAlert(opts: { subject: string; lines: string[] }) {
  const to = import.meta.env.OPERATOR_ALERT_EMAIL || FROM_ADDRESS;
  try {
    return await unwrap(
      client().emails.send({
        from: FROM,
        to,
        replyTo: FROM_ADDRESS,
        subject: opts.subject,
        text: opts.lines.join('\n'),
      })
    );
  } catch (err) {
    console.error('[operator-alert] failed to send alert email:', err);
    return null;
  }
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
 * Mark a contact unsubscribed. Backs the one-click unsubscribe endpoint
 * (/api/unsubscribe) so the List-Unsubscribe header actually stops the drip.
 */
export async function unsubscribeContact(email: string) {
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  if (!audienceId) throw new Error('RESEND_AUDIENCE_ID is not configured.');
  return unwrap(
    client().contacts.update({
      audienceId,
      email: email.toLowerCase(),
      unsubscribed: true,
    })
  );
}

// Exposed for the nurture series (nurture.ts) so every email carries the
// same Rule-4 disclaimer and sender identity.
export { FROM_ADDRESS, DISCLAIMER_TEXT };

/**
 * Generic email send for the lifecycle/nurture series. Adds the standard
 * sender, reply-to, and a List-Unsubscribe header. Used by nurture.ts.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  // RFC 8058 one-click unsubscribe. The HTTPS target lets Gmail/Yahoo/Apple
  // render a native "Unsubscribe" button that POSTs to our endpoint and
  // genuinely stops the drip; the mailto is the fallback. The List-Unsubscribe-Post
  // header is what signals true one-click support to the mailbox provider.
  const siteBase =
    import.meta.env.SITE_URL?.replace(/\/$/, '') || 'https://millertrustguide.com';
  const unsubUrl = `${siteBase}/api/unsubscribe?token=${encodeURIComponent(
    createUnsubscribeToken(opts.to)
  )}`;
  return unwrap(
    client().emails.send({
      from: FROM,
      to: opts.to,
      replyTo: FROM_ADDRESS,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>, <mailto:${FROM_ADDRESS}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
  );
}

export interface AudienceContact {
  email: string;
  createdAt: string;
  unsubscribed: boolean;
}

/**
 * List every contact in the nurture Audience. The drip cron
 * (/api/cron/nurture) uses each contact's createdAt to decide which email
 * is due. Assumes a single page — fine at MVP volume; revisit with cursor
 * pagination if the audience grows past Resend's per-page limit.
 */
export async function listAudienceContacts(): Promise<AudienceContact[]> {
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  if (!audienceId) throw new Error('RESEND_AUDIENCE_ID is not configured.');
  const result = (await unwrap(client().contacts.list({ audienceId }))) as {
    data?: Array<{ email?: string; created_at?: string; unsubscribed?: boolean }>;
  };
  const rows = result?.data ?? [];
  return rows
    .filter((r): r is { email: string; created_at: string; unsubscribed?: boolean } =>
      typeof r.email === 'string' && typeof r.created_at === 'string'
    )
    .map((r) => ({
      email: r.email,
      createdAt: r.created_at,
      unsubscribed: Boolean(r.unsubscribed),
    }));
}
