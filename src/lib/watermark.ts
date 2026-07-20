// Per-purchase PDF watermarking ("Social DRM") for kit delivery.
//
// The kit PDFs in Vercel Blob are byte-identical for every buyer. To deter and
// trace redistribution, /api/download stamps the purchaser's identity onto
// every page at delivery time, so the file each buyer receives is unique to
// them. A B2C kit handed to hundreds of families is then self-incriminating
// ("...personal household use — not for redistribution", with the buyer's name
// on every page) and traceable back to the order.
//
// This is deterrence, not DRM — a determined actor can strip a footer. The real
// moat is the licence terms + the B2B tier being strictly better. We overlay
// with pdf-lib (pure JS, no native deps, no headless browser), which is cheap
// enough to run inside a Vercel serverless function. pdf-lib is dynamically
// imported to keep it off the SSR bundle boundary (mirrors src/lib/blob.ts).

export interface StampOptions {
  /** Small lines drawn along the bottom margin of every page. */
  footerLines: string[];
  /** Faint text drawn diagonally across every page (e.g. the buyer's email). */
  diagonalText?: string;
  /** Licence/order id embedded in PDF metadata for a second, non-visible trace. */
  metadataId?: string;
  /** Co-brand line drawn at the top of the first page only (B2B facility name). */
  coverBrand?: string;
}

/**
 * Overlay the given identity onto every page of a PDF and return the new bytes.
 * Never mutates the input. Throws only if the PDF cannot be parsed — callers on
 * the paid money path should catch and fall back to the un-stamped bytes so a
 * watermarking hiccup never blocks a legitimate download.
 */
export async function stampPdf(
  input: Uint8Array | ArrayBuffer,
  opts: StampOptions
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const footerLines = opts.footerLines
    .map((l) => (l ?? '').trim())
    .filter((l) => l.length > 0);

  const footerColor = rgb(0.42, 0.42, 0.42);
  const diagonalColor = rgb(0.6, 0.6, 0.6);
  const brandColor = rgb(0.06, 0.3, 0.29); // matches the site's teal

  const pages = doc.getPages();

  // B2B co-brand band at the top of the first page only.
  if (opts.coverBrand && pages.length > 0) {
    const first = pages[0];
    const { width, height } = first.getSize();
    const size = 10;
    const tw = font.widthOfTextAtSize(opts.coverBrand, size);
    first.drawText(opts.coverBrand, {
      x: Math.max(18, (width - tw) / 2),
      y: height - 26,
      size,
      font,
      color: brandColor,
      opacity: 0.95,
    });
  }

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Very faint diagonal background mark — visible enough to signal "licensed
    // copy" but low enough opacity that it never harms readability of a paid,
    // legitimate kit.
    if (opts.diagonalText) {
      const size = 24;
      page.drawText(opts.diagonalText, {
        x: width * 0.12,
        y: height * 0.32,
        size,
        font,
        color: diagonalColor,
        rotate: degrees(30),
        opacity: 0.07,
      });
    }

    // Footer identity lines stacked in the bottom margin (drawn bottom-up).
    let y = 13;
    for (let i = footerLines.length - 1; i >= 0; i--) {
      const line = footerLines[i];
      const size = 7;
      const textWidth = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: Math.max(18, (width - textWidth) / 2),
        y,
        size,
        font,
        color: footerColor,
        opacity: 0.9,
      });
      y += 9;
    }
  }

  // Forensic metadata: a second identifier a casual re-save may preserve.
  // (Note: pdf-lib always overwrites the PDF `Producer` with its own signature
  // on save, so we carry the trace in Keywords + Subject, which do persist.)
  if (opts.metadataId) {
    doc.setKeywords([`license:${opts.metadataId}`]);
    doc.setSubject(`Licensed copy — ${opts.metadataId} — © Miller Trust Guide`);
  }

  return doc.save();
}
