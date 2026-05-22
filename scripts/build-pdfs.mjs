#!/usr/bin/env node
/**
 * Build state kit PDFs from the /kits/[slug] routes.
 *
 * Pipeline:
 *   1. Read every live state from src/content/states/*.mdx.
 *   2. Start the Astro dev server. (We use `astro dev`, not `astro preview`:
 *      the Vercel adapter does not support `preview`. The kit route is
 *      prerender=true, so dev renders it identically to a production build.)
 *   3. Open the /kits/{slug} URL in headless Chromium via Playwright.
 *   4. Let Paged.js (loaded by the page) paginate the HTML into pages.
 *   5. Print the page to PDF with no extra browser-chrome margins, since
 *      Paged.js already manages page geometry via @page rules.
 *   6. Save to dist/kits/{slug}-{kitVersion}.pdf.
 *
 * Upload to Vercel Blob is a separate, manual step — the operator runs:
 *   npx vercel blob put dist/kits/texas-v1.0.pdf --pathname kits/texas/v1.pdf
 *
 * (Keeping upload manual on purpose — we do not want a build script that
 * silently mutates production fulfillment storage.)
 *
 * Usage:
 *   npm run kits:build             # render all live-state PDFs
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
const SERVER_PORT = 4322;
const SERVER_BASE = `http://127.0.0.1:${SERVER_PORT}`;
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

function startDevServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['astro', 'dev', '--host', '127.0.0.1', '--port', String(SERVER_PORT)],
      { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let ready = false;
    const onData = (buf) => {
      const text = buf.toString();
      // `astro dev` prints "Local  http://127.0.0.1:4322/" once listening.
      if (!ready && /localhost|127\.0\.0\.1|ready in/i.test(text)) {
        ready = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => {
      if (!ready) reject(new Error(`astro dev exited (code ${code}) before ready`));
    });
    setTimeout(() => {
      if (!ready) reject(new Error('astro dev did not become ready within 45s'));
    }, 45_000);
  });
}

async function renderState(browser, state) {
  const page = await browser.newPage();

  // Register a Paged.js completion flag BEFORE any page script runs, so we
  // never miss the event. Paged.js dispatches `pagedjs-rendered`; we listen
  // on both window and document since the target has varied across versions.
  await page.addInitScript(() => {
    window.__pagedjsDone = false;
    const mark = () => {
      window.__pagedjsDone = true;
    };
    window.addEventListener('pagedjs-rendered', mark);
    document.addEventListener('pagedjs-rendered', mark);
  });

  const url = `${SERVER_BASE}/kits/${state.slug}`;
  console.log(`  -> ${state.slug}: navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: RENDER_TIMEOUT_MS });

  // Wait for Paged.js to FINISH paginating — not just start. The
  // .pagedjs_pages container appears after page 1; printing then captures a
  // half-finished render (truncated PDF + an unresolved `counter(pages)`).
  //
  // Primary signal: the pagedjs-rendered completion event. Fallback signal:
  // page-count stability — once the .pagedjs_page count stops growing for
  // ~3s, pagination is done. Either is sufficient.
  console.log(`  -> ${state.slug}: waiting for Paged.js to finish pagination`);
  await page.waitForFunction(
    () => {
      if (window.__pagedjsDone) return true;
      const count = document.querySelectorAll('.pagedjs_page').length;
      if (count === 0) return false;
      if (window.__lastCount === count) {
        window.__stableTicks = (window.__stableTicks || 0) + 1;
      } else {
        window.__stableTicks = 0;
        window.__lastCount = count;
      }
      return window.__stableTicks >= 6; // 6 polls x 500ms = ~3s with no new pages
    },
    { timeout: RENDER_TIMEOUT_MS, polling: 500 }
  );

  const pageCount = await page.evaluate(
    () => document.querySelectorAll('.pagedjs_page').length
  );
  console.log(`  -> ${state.slug}: Paged.js produced ${pageCount} pages`);

  // Settle for web fonts and final running-counter resolution.
  await page.waitForTimeout(1000);

  // Neutralize the native @page rule for the print pass. Paged.js has
  // already baked the page margins and the running header/footer into the
  // .pagedjs_page DOM. If Chromium ALSO applies the authored @page rule
  // natively, it (a) re-applies the margins, squeezing each finished 8.5x11
  // page into the content box and shrinking the text, and (b) re-draws the
  // running header/footer in the native margin boxes — a second, duplicate
  // page number. Suppressing the native @page leaves only Paged.js's output.
  await page.addStyleTag({
    content: `@page {
      size: Letter;
      margin: 0 !important;
      @top-left { content: none !important; }
      @top-center { content: none !important; }
      @top-right { content: none !important; }
      @bottom-left { content: none !important; }
      @bottom-center { content: none !important; }
      @bottom-right { content: none !important; }
    }`,
  });

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const filename = `${state.slug}-${state.kitVersion}.pdf`;
  const outPath = join(OUT_DIR, filename);

  console.log(`  -> ${state.slug}: printing PDF`);
  await page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true,
    // Paged.js manages all page geometry — Chromium adds no margin of its own.
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await page.close();
  console.log(`     wrote ${filename}`);
  return outPath;
}

async function main() {
  const states = readStates();
  if (states.length === 0) {
    console.error('No live states matched.');
    process.exit(1);
  }

  console.log(`Starting Astro dev server on port ${SERVER_PORT}...`);
  const server = await startDevServer();

  console.log('Launching headless Chromium...');
  const browser = await chromium.launch();

  try {
    for (const state of states) {
      await renderState(browser, state);
    }
  } finally {
    await browser.close();
    server.kill();
  }

  console.log('\nDone.');
  console.log('To deliver to buyers, upload each PDF to Vercel Blob at the');
  console.log('canonical key for that state, e.g.:');
  console.log('  npx vercel blob put dist/kits/texas-v1.0.pdf --pathname kits/texas/v1.pdf');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
