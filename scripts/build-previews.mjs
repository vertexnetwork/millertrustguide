#!/usr/bin/env node
/**
 * Regenerate kit preview images from the LIVE /kits/[slug] render, so the
 * preview PNGs in public/kit-previews/{slug}/ never drift from the kit PDF.
 *
 * Why this exists: the previews are static screenshots. They were captured
 * once, by hand, then the kit content changed (31 -> 34 pages) and the
 * previews silently went stale (old page-count footer). This script captures
 * them programmatically from the same Paged.js render the PDF is built from,
 * matching pages by HEADING text (not page index) so it stays correct as
 * content shifts and as new states are added.
 *
 * Pipeline (mirrors build-pdfs.mjs): start astro dev, open /kits/{slug} in
 * headless Chromium at 2x device scale, wait for Paged.js to finish, then for
 * each preview find the .pagedjs_page whose heading matches and screenshot it.
 *
 * Filenames + match strings are kept in sync with src/components/PdfPreview.astro.
 *
 * Usage:
 *   npm run kits:previews             # all live states
 *   npm run kits:previews -- texas    # one state
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STATES_DIR = join(ROOT, 'src', 'content', 'states');
const SERVER_PORT = 4323;
const SERVER_BASE = `http://127.0.0.1:${SERVER_PORT}`;
const RENDER_TIMEOUT_MS = 60_000;

// Keep in sync with PdfPreview.astro. `match` is matched (case-insensitive)
// against each page's heading text, so a section page is found by its title
// regardless of where it lands as content shifts. TOC listings won't match
// because we look at heading elements, not body links.
const PREVIEWS = [
  { file: '01-cover.png', match: 'setup kit' },
  { file: '02-toc.png', match: 'table of contents' },
  { file: '03-glossary.png', match: 'key terms' },
  { file: '04-section5-intro.png', match: 'bank-account walkthrough' },
  { file: '06-appendix-a.png', match: 'citations index' },
];

const targetSlug = process.argv[2]?.toLowerCase();

function readLiveStates() {
  return readdirSync(STATES_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const slug = f.replace(/\.mdx$/, '');
      const status = /^status:\s*"?(\w+)"?/m.exec(readFileSync(join(STATES_DIR, f), 'utf8'))?.[1];
      return { slug, status };
    })
    .filter((s) => s.status === 'live' && (!targetSlug || s.slug === targetSlug));
}

function startDevServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['astro', 'dev', '--host', '127.0.0.1', '--port', String(SERVER_PORT)], {
      cwd: ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    const onData = (buf) => {
      if (!ready && /localhost|127\.0\.0\.1|ready in/i.test(buf.toString())) {
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

async function capture(browser, state) {
  const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1024, height: 1320 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__pagedjsDone = false;
    const mark = () => (window.__pagedjsDone = true);
    window.addEventListener('pagedjs-rendered', mark);
    document.addEventListener('pagedjs-rendered', mark);
  });

  console.log(`  -> ${state.slug}: ${SERVER_BASE}/kits/${state.slug}`);
  await page.goto(`${SERVER_BASE}/kits/${state.slug}`, { waitUntil: 'domcontentloaded', timeout: RENDER_TIMEOUT_MS });
  await page.waitForFunction(
    () => {
      if (window.__pagedjsDone) return true;
      const count = document.querySelectorAll('.pagedjs_page').length;
      if (count === 0) return false;
      if (window.__lastCount === count) window.__stableTicks = (window.__stableTicks || 0) + 1;
      else { window.__stableTicks = 0; window.__lastCount = count; }
      return window.__stableTicks >= 6;
    },
    { timeout: RENDER_TIMEOUT_MS, polling: 500 }
  );
  await page.waitForTimeout(1000); // settle fonts + running counters

  const outDir = join(ROOT, 'public', 'kit-previews', state.slug);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const { file, match } of PREVIEWS) {
    // Find the page index whose heading text contains the match string.
    const idx = await page.evaluate((needle) => {
      const pages = [...document.querySelectorAll('.pagedjs_page')];
      const has = (el) => [...el.querySelectorAll('h1,h2,h3,h4')].some((h) => (h.textContent || '').toLowerCase().includes(needle));
      let i = pages.findIndex(has);
      if (i === -1) i = pages.findIndex((p) => (p.textContent || '').toLowerCase().includes(needle)); // fallback: any text
      return i;
    }, match);

    if (idx === -1) {
      console.warn(`     ! ${file}: no page matched "${match}" — skipped`);
      continue;
    }
    const el = page.locator('.pagedjs_page').nth(idx);
    await el.screenshot({ path: join(outDir, file) });
    console.log(`     wrote ${file} (page ${idx + 1}, matched "${match}")`);
  }

  await ctx.close();
}

async function main() {
  const states = readLiveStates();
  if (states.length === 0) {
    console.error('No live states matched.');
    process.exit(1);
  }
  console.log(`Starting Astro dev server on ${SERVER_PORT}...`);
  const server = await startDevServer();
  console.log('Launching headless Chromium (2x)...');
  const browser = await chromium.launch();
  try {
    for (const state of states) await capture(browser, state);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('\nDone. Previews regenerated. Commit public/kit-previews/<slug>/ and deploy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
