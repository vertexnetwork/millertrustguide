#!/usr/bin/env node
/**
 * Upload a built state kit PDF to Vercel Blob at its canonical fulfillment key.
 *
 * EXPLICIT + operator-invoked (never wired into build/postbuild) so production
 * fulfillment storage is never mutated silently — same principle as
 * build-pdfs.mjs. Reads BLOB_READ_WRITE_TOKEN from the environment or .env.local
 * (gitignored). Reads the canonical Blob key (pdfBlobKey) and kit version from
 * the state's .mdx frontmatter, so the key always matches what the webhook
 * checks (src/lib/blob.ts -> kitBlobExists).
 *
 * Usage:
 *   npm run kits:build -- texas     # produce dist/kits/texas-<kitVersion>.pdf first
 *   npm run kit:upload -- texas     # then upload it to Blob at kits/texas/v1.pdf
 *   npm run kit:upload -- texas v1.0  # optional explicit local version
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put, del, list } from '@vercel/blob';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Load .env.local into process.env (only for keys not already set).
function loadEnvLocal() {
  const p = join(ROOT, '.env.local');
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvLocal();

const slug = (process.argv[2] || '').toLowerCase();
if (!slug) {
  console.error('Usage: npm run kit:upload -- <state-slug> [localVersion]');
  process.exit(1);
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token || /replace_me/.test(token)) {
  console.error(
    'BLOB_READ_WRITE_TOKEN missing/placeholder.\n' +
      'Add the real token to .env.local (gitignored). Get it from:\n' +
      '  Vercel -> your project -> Storage -> the Blob store -> ".env.local" tab\n' +
      '  (or: `vercel link` then `vercel env pull .env.local`).'
  );
  process.exit(1);
}

// Read the canonical Blob key + version from the state's frontmatter so the
// upload target always matches the webhook's kitBlobExists() lookup.
const mdxPath = join(ROOT, 'src/content/states', `${slug}.mdx`);
if (!existsSync(mdxPath)) {
  console.error(`No state file at src/content/states/${slug}.mdx`);
  process.exit(1);
}
const mdx = readFileSync(mdxPath, 'utf8');
const blobKey = /^pdfBlobKey:\s*"?([^"\n]+)"?/m.exec(mdx)?.[1];
const kitVersion = process.argv[3] || /^kitVersion:\s*"?([^"\n]+)"?/m.exec(mdx)?.[1];
if (!blobKey) {
  console.error(`Could not read pdfBlobKey from ${slug}.mdx`);
  process.exit(1);
}

// Locate the built PDF (dist/kits/<slug>-<kitVersion>.pdf, with a fallback).
let pdfPath = join(ROOT, 'dist/kits', `${slug}-${kitVersion}.pdf`);
if (!existsSync(pdfPath)) {
  const dir = join(ROOT, 'dist/kits');
  const found = existsSync(dir)
    ? readdirSync(dir).find((f) => f.startsWith(`${slug}-`) && f.endsWith('.pdf'))
    : null;
  if (!found) {
    console.error(`No built PDF found at ${pdfPath}\nRun: npm run kits:build -- ${slug}`);
    process.exit(1);
  }
  pdfPath = join(dir, found);
}

const bytes = readFileSync(pdfPath);
console.log(`Uploading ${pdfPath} (${(bytes.length / 1024).toFixed(0)} KB) -> Blob "${blobKey}" ...`);

// Delete any existing blob at this pathname FIRST. Vercel Blob CDN-caches public
// blobs (default ~30 days); a plain overwrite leaves the edge serving the stale
// copy, which the webhook would then deliver. del() purges it; we then re-put
// with cacheControlMaxAge: 0 so the fulfillment artifact is always current.
try {
  const { blobs } = await list({ prefix: blobKey, token });
  const existing = blobs.find((b) => b.pathname === blobKey);
  if (existing) {
    await del(existing.url, { token });
    console.log(`  (deleted stale blob to bust CDN cache)`);
  }
} catch (e) {
  console.warn('  (pre-delete check failed; continuing):', e?.message || e);
}

const res = await put(blobKey, bytes, {
  access: 'public',
  addRandomSuffix: false, // pathname MUST equal pdfBlobKey exactly (webhook matches on it)
  allowOverwrite: true,
  contentType: 'application/pdf',
  cacheControlMaxAge: 0, // fulfillment artifact must always be fresh, never edge-cached stale
  token,
});

console.log('\n✓ Uploaded.');
console.log('  pathname:', res.pathname);
console.log('  url:     ', res.url);
if (res.pathname !== blobKey) {
  console.warn(`\n⚠ pathname "${res.pathname}" != expected "${blobKey}" — the webhook will NOT find it. Investigate.`);
} else {
  console.log(`\nNext: re-fire delivery — Stripe Dashboard -> Developers -> Webhooks -> the failed event -> Resend (or wait for the auto-retry).`);
}
