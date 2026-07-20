// B2B co-branded kit download. Session-gated (not a one-shot token). Re-checks
// the subscription live against Stripe when the session snapshot is stale
// (bounds post-cancellation access), confirms the state is entitled, then
// stamps the shared base PDF with the facility co-brand + license and serves it.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { verifySessionToken, createSessionToken } from '~/lib/session-token';
import { resolveEntitlementForCustomer } from '~/lib/stripe-b2b';
import { getKitBlobBytes } from '~/lib/blob';
import { stampPdf } from '~/lib/watermark';
import { brandedPage } from '~/lib/html-response';
import {
  B2B_SESSION_COOKIE,
  B2B_SESSION_TTL_MIN,
  B2B_FRESHNESS_REVERIFY_SEC,
} from '~/config/b2b';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  const raw = cookies.get(B2B_SESSION_COOKIE)?.value;
  const session = raw ? verifySessionToken(raw) : null;
  if (!session) {
    return brandedPage(
      401,
      'Please sign in',
      'Your session has ended. Return to the portal and sign in again to download your kits.'
    );
  }

  const stateSlug = (url.searchParams.get('state') || '').trim().toLowerCase();
  if (!stateSlug) {
    return brandedPage(400, 'Missing state', 'No state was specified for this download.');
  }

  // Freshness re-check: if the session snapshot is stale, re-resolve live.
  let entitledStates = session.entitledStates;
  let facilityName = session.facilityName;
  const ageSec = Math.floor(Date.now() / 1000) - session.verifiedAt;
  if (ageSec > B2B_FRESHNESS_REVERIFY_SEC) {
    try {
      const fresh = await resolveEntitlementForCustomer(session.customerId);
      entitledStates = fresh.entitledStates;
      if (fresh.facilityName) facilityName = fresh.facilityName;
      // Re-mint the cookie with a fresh verifiedAt so later loads stay cheap.
      const verifiedAt = Math.floor(Date.now() / 1000);
      const { token } = createSessionToken({
        email: session.email,
        customerId: session.customerId,
        entitledStates,
        facilityName,
        verifiedAt,
      });
      cookies.set(B2B_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: B2B_SESSION_TTL_MIN * 60,
      });
    } catch (err) {
      console.error('[b2b download] freshness re-check failed:', err);
      // Fail closed: don't serve on an unverifiable subscription.
      return brandedPage(
        403,
        'We could not confirm your subscription',
        'Please try again in a moment, or email support@millertrustguide.com.'
      );
    }
  }

  if (!entitledStates.includes(stateSlug)) {
    return brandedPage(
      403,
      'Not included in your license',
      'Your facility license does not include this state. Manage your plan from the portal, or email support@millertrustguide.com to add it.'
    );
  }

  const states = await getCollection('states');
  const entry = states.find((s) => s.slug === stateSlug);
  if (!entry) {
    return brandedPage(
      404,
      'Kit not found',
      'We could not match this to a kit. Please email support@millertrustguide.com.'
    );
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await getKitBlobBytes(entry.data.pdfBlobKey);
  } catch (err) {
    console.error('[b2b download] blob fetch failed:', err);
    return brandedPage(
      500,
      'We could not retrieve the kit',
      'Something went wrong fetching the file. Please email support@millertrustguide.com.'
    );
  }

  const brand = facilityName || 'Licensed facility';
  let delivered: Uint8Array = pdfBytes;
  try {
    delivered = await stampPdf(pdfBytes, {
      coverBrand: `Provided to families by ${brand}`,
      footerLines: [
        `Distributed by ${brand} under license ${session.customerId}`,
        'Licensed for distribution to residents & families. © Miller Trust Guide — informational, not legal advice.',
      ],
      metadataId: session.customerId,
    });
  } catch (err) {
    console.error('[b2b download] watermarking failed; serving un-stamped copy:', err);
    delivered = pdfBytes;
  }

  // Fresh ArrayBuffer-backed copy → well-typed BodyInit.
  const body = new Uint8Array(delivered.byteLength);
  body.set(delivered);

  const filename = `${stateSlug}-miller-trust-kit-${slugify(brand)}.pdf`;
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'facility';
}
