#!/usr/bin/env node
/**
 * Build state kit PDFs from the prerendered /kits/[slug] HTML routes.
 *
 * Pipeline:
 *   1. Read every live state from src/content/states/*.mdx.
 *   2. For each state, start a local Astro preview server (assumes the
 *      site has already been built — run `npm run build` first).
 *   3. Open the /kits/{slug} URL in headless Chromium via Playwright.
 *   4. Let Paged.js (loaded by the page) paginate the HTML into pages.
 *   5. Print the page to PDF with no extra browser-chrome margins, since
 *      Paged.js already manages page geometry via @page rules.
 *   6. Save to dist/kits/{slug}-{kitVersion}.pdf.
 *
 * Upload to Vercel Blob is a separate, manual step — the operator runs:
 *   npx vercel blob put dist/kits/texas-v1.0.pdf --path kits/texas/v1.pdf
 *
 * (Keeping upload manual on purpose — we do not want a build script that
 * silently mutates production fulfillment storage.)
 *
 * Usage:
 *   npm run build                  # build the site (includes /kits/[slug])
 *   npm run kits:build             # render PDFs
 *   npm run kits:build -- texas    # render a specific state
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STATES_DIR = join(ROOT, 'src', 'content', 'states');
const OUT_DIR = join(ROOT, 'dist', 'kits');
const PREVIEW_PORT = 4322;
const PREVIEW_BASE = `http://127.0.0.1:${PREVIEW_PORT}`;
const RENDER_TIMEOUT_MS = 60_000;

const targetSlug = process.argv[2]?.toLowerCase();

function readStates() {
  return readdirSync(STATES_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const slug = f.replace(/\.mdx$/, '');
      const text = readFileSync(join(STATES_DIR, f), 'utf8');
      const status = /^status:\s*"?(\w+)"?/m.exec(text)?.[1];
      const kitVersion = /^kitVersion:\s*"?([^"\n]+)"?/m.exec(text)?.[1];
      return { slug, status, kitVersion };
    })
    .filter((s) => s.status === 'live' && (!targetSlug || s.slug === targetSlug));
}

function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT)],
      { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let ready = false;
    const onData = (buf) => {
      const text = buf.toString();
      if (!ready && /listening|localhost|127\.0\.0\.1/i.test(text)) {
        ready = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => {
      if (!ready) reject(new Error(`astro preview exited (code ${code}) before ready`));
    });
    setTimeout(() => {
      if (!ready) reject(new Error('astro preview did not become ready within 30s'));
    }, 30_000);
  });
}

async function renderState(browser, state) {
  const page = await browser.newPage();
  const url = `${PREVIEW_BASE}/kits/${state.slug}`;

  console.log(`  -> ${state.slug}: navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: RENDER_TIMEOUT_MS });

  // Paged.js dispatches a `pagedjs-rendered` event on document when done.
  // We also poll for the .pagedjs_pages container as a fallback in case
  // the event has already fired before our listener attaches.
  console.log(`  -> ${state.slug}: waiting for Paged.js to finish layout`);
  await page.waitForFunction(
    () => document.querySelector('.pagedjs_pages') !== null,
    { timeout: RENDER_TIMEOUT_MS }
  );
  // Brief settle for web fonts.
  await page.waitForTimeout(500);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const filename = `${state.slug}-${state.kitVersion}.pdf`;
  const outPath = join(OUT_DIR, filename);

  console.log(`  -> ${state.slug}: printing PDF`);
  await page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true,
    // Paged.js manages all page geometry via @page rules — we just tell
    // Chromium not to apply its own margins on top.
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await page.close();
  console.log(`     wrote ${filename}`);
  return outPath;
}

async function main() {
  const states = readStates();
  if (states.length === 0) {
    console.error('No live states matched. Did you build the site first? (npm run build)');
    process.exit(1);
  }

  console.log(`Starting Astro preview on port ${PREVIEW_PORT}...`);
  const preview = await startPreview();

  console.log('Launching headless Chromium...');
  const browser = await chromium.launch();

  try {
    for (const state of states) {
      await renderState(browser, state);
    }
  } finally {
    await browser.close();
    preview.kill();
  }

  console.log('\nDone.');
  console.log('To deliver to buyers, upload each PDF to Vercel Blob at the');
  console.log('canonical key for that state, e.g.:');
  console.log('  npx vercel blob put dist/kits/texas-v1.0.pdf --path kits/texas/v1.pdf');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
