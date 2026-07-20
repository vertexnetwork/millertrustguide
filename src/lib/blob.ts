// Vercel Blob access for kit PDFs.
//
// The kit PDF's Blob storage URL is NEVER sent to a buyer. The delivery
// email links to /api/download?token=..., and that endpoint calls
// getKitBlobStream() to fetch the PDF server-side and proxy the bytes back.
// The buyer's only access path is the signed, expiring token — see
// download-token.ts. Access control is enforced by us, not by the storage
// layer, so a blob URL can never be forwarded or outlive its 7-day window.
//
// We resolve blobs with list({ prefix }) rather than head(): list reliably
// accepts a pathname, head's pathname support is less certain across SDK
// versions. The dynamic import keeps the Node-only SDK off the SSR boundary.

/** True if a kit PDF is present at the given Blob pathname. */
export async function kitBlobExists(pdfBlobKey: string): Promise<boolean> {
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: pdfBlobKey });
  return blobs.some((b) => b.pathname === pdfBlobKey);
}

export interface KitBlobStream {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  size: number | null;
}

/**
 * Resolve the kit PDF at `pdfBlobKey` and return its byte stream for the
 * download endpoint to proxy. Throws if the blob is missing or unfetchable.
 */
export async function getKitBlobStream(pdfBlobKey: string): Promise<KitBlobStream> {
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: pdfBlobKey });
  const match = blobs.find((b) => b.pathname === pdfBlobKey);
  if (!match) throw new Error(`Kit PDF not found at blob key: ${pdfBlobKey}`);

  const res = await fetch(match.url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to fetch kit blob (HTTP ${res.status}) for key: ${pdfBlobKey}`);
  }

  return {
    body: res.body,
    contentType: res.headers.get('content-type') || 'application/pdf',
    size: match.size ?? null,
  };
}

/**
 * Resolve the kit PDF at `pdfBlobKey` and return its full bytes. Used by the
 * download endpoint when it needs the whole file in memory (e.g. to watermark
 * it before delivery) rather than streaming it straight through. Throws if the
 * blob is missing or unfetchable.
 */
export async function getKitBlobBytes(pdfBlobKey: string): Promise<Uint8Array> {
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: pdfBlobKey });
  const match = blobs.find((b) => b.pathname === pdfBlobKey);
  if (!match) throw new Error(`Kit PDF not found at blob key: ${pdfBlobKey}`);

  const res = await fetch(match.url);
  if (!res.ok) {
    throw new Error(`Failed to fetch kit blob (HTTP ${res.status}) for key: ${pdfBlobKey}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}
