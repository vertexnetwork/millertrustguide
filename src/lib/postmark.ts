import * as postmark from 'postmark';

let cached: postmark.ServerClient | null = null;

function client(): postmark.ServerClient {
  if (cached) return cached;
  const token = import.meta.env.POSTMARK_SERVER_TOKEN;
  if (!token) throw new Error('POSTMARK_SERVER_TOKEN is not configured.');
  cached = new postmark.ServerClient(token);
  return cached;
}

const FROM_ADDRESS = import.meta.env.POSTMARK_FROM_ADDRESS || 'support@millertrustguide.com';
const FROM_NAME = import.meta.env.POSTMARK_FROM_NAME || 'James Whitfield at Miller Trust Guide';

const DISCLAIMER_TEXT = `Informational only. This product is not legal advice and is not a substitute for consultation with a licensed attorney. We are not a law firm and we do not practice law. We do not draft legal documents. State Medicaid rules vary and change; verify all information with your state Medicaid agency and an attorney licensed in your state before acting.`;

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
1. Read sections 1–3 first.
2. Complete the funding worksheet in section 4 before you visit the bank.
3. Have the documents listed in section 5 ready before opening the trust account.

Lost the link? Reply to this email and we will resend.

Money-back guarantee: if ${params.agencyAbbreviation} rejects your QIT for any reason traceable to following the kit, reply with the agency's stated denial reason and we issue a full refund within one business day.

Order reference: ${params.orderId}

— James Whitfield
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
    <li>Read sections 1–3 first.</li>
    <li>Complete the funding worksheet in section 4 before you visit the bank.</li>
    <li>Have the documents listed in section 5 ready before opening the trust account.</li>
  </ol>
  <p>Lost the link? Reply to this email and we will resend.</p>
  <h2 style="font-family: Georgia, serif; color: #0F4C4A; font-size: 18px;">Money-back guarantee</h2>
  <p>If ${params.agencyAbbreviation} rejects your QIT for any reason traceable to following the kit, reply with the agency's stated denial reason and we issue a full refund within one business day.</p>
  <p style="color: #6B7280; font-size: 13px;">Order reference: ${params.orderId}</p>
  <p style="color: #6B7280; font-size: 13px;">— James Whitfield, Miller Trust Guide, support@millertrustguide.com</p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
  <p style="color: #78350F; background:#FEF3C7; padding:12px; border-radius:6px; font-size: 12px;">${DISCLAIMER_TEXT}</p>
</body></html>`;

  return client().sendEmail({
    From: `${FROM_NAME} <${FROM_ADDRESS}>`,
    To: params.to,
    Subject: `Your ${params.stateName} Miller Trust Kit — download link inside`,
    TextBody: textBody,
    HtmlBody: htmlBody,
    MessageStream: 'outbound',
    ReplyTo: FROM_ADDRESS,
    TrackOpens: false,
  });
}
