#!/usr/bin/env node
/**
 * Build the free per-state lead-magnet checklist PDFs from the /checklist/[slug]
 * routes, into public/checklist/<slug>.pdf (served at /checklist/<slug>.pdf and
 * committed like the OG images and kit previews).
 *
 * Unlike the paid kit (scripts/build-pdfs.mjs, which needs Paged.js for a long,
 * running-header document), the checklist is 1–2 pages, so we let Chromium do
 * native pagination from a plain print stylesheet — simpler and no double-margin
 * pitfalls. The route's @page rule sets Letter size + margins; we print with
 * preferCSSPageSize so those win.
 *
 * These PDFs are a FREE, public marketing asset — safe to commit (they are not
 * the paid product, which stays private in Vercel Blob). Regenerate whenever a
 * state's commonDenialReasons / income cap / private-pay range changes.
 *
 * Usage:
 *   npm run leadmagnets:build            # all live states
 *   npm run leadmagnets:build -- texas   # one state
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STATES_DIR = join(ROOT, 'src', 'content', 'states');
const OUT_DIR = join(ROOT, 'public', 'checklist');
const SERVER_PORT = 4323;
const SERVER_BASE = `http://127.0.0.1:${SERVER_PORT}`;
const RENDER_TIMEOUT_MS = 60_000;

const targetSlug = process.argv[2]?.toLowerCase();

function readLiveStates() {
  return readdirSync(STATES_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => {
      const slug = f.replace(/\.mdx$/, '');
      const text = readFileSync(join(STATES_DIR, f), 'utf8');
      const status = /^status:\s*"?(\w+)"?/m.exec(text)?.[1];
      return { slug, status };
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
  const url = `${SERVER_BASE}/checklist/${state.slug}`;
  console.log(`  -> ${state.slug}: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: RENDER_TIMEOUT_MS });

  // Wait for the document body and web fonts so text metrics are final.
  await page.waitForSelector('main.sheet', { timeout: RENDER_TIMEOUT_MS });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(400);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${state.slug}.pdf`);

  await page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true, // honor the route's @page Letter + margins
  });

  await page.close();
  console.log(`     wrote public/checklist/${state.slug}.pdf`);
  return outPath;
}

async function main() {
  const states = readLiveStates();
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

  console.log('\nDone. Commit public/checklist/*.pdf alongside the state content.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
