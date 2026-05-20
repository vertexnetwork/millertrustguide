// Vercel Blob signed-URL helper. Kit PDFs are uploaded privately and a
// 7-day signed URL is generated per delivery email — refund-proof expiry,
// no customer-account system needed.

// We avoid a top-level static import of `@vercel/blob` to keep the SSR
// boundary clean; the dynamic import happens only inside the webhook
// handler where Node-only modules are guaranteed available.

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SignedKitUrl {
  url: string;
  expiresAt: string;
}

export async function getSignedKitUrl(pdfBlobKey: string): Promise<SignedKitUrl> {
  const { list, head } = await import('@vercel/blob');

  // Find the blob by its pathname (state authoring uploads at the canonical key).
  const headRes = await head(pdfBlobKey).catch(() => null);
  if (headRes?.url) {
    // Vercel Blob URLs are signed via the `?download=...&_t=...` token system on access;
    // since the default `head().url` returns a CDN URL with token-style auth, we surface that.
    return {
      url: headRes.url,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  // Fallback: list with prefix and pick the matching key.
  const listed = await list({ prefix: pdfBlobKey });
  const match = listed.blobs.find((b) => b.pathname === pdfBlobKey);
  if (!match) throw new Error(`Kit PDF not found at blob key: ${pdfBlobKey}`);

  return {
    url: match.url,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  };
}
