#!/usr/bin/env node
/**
 * IndexNow submission script.
 *
 * Reads the built sitemap-index.xml + sitemap-0.xml from dist/, collects all
 * URLs, and POSTs them to https://api.indexnow.org/IndexNow. Bing, Yandex,
 * DuckDuckGo, Seznam, Naver, and Yep consume IndexNow. Google does not.
 *
 * Env vars:
 *   INDEXNOW_KEY        — 32-char hex key (also published at /{key}.txt).
 *   INDEXNOW_HOST       — defaults to millertrustguide.com.
 *   INDEXNOW_KEY_LOCATION — defaults to https://{host}/{key}.txt.
 *
 * Usage:
 *   node scripts/indexnow-submit.mjs
 *
 * Wire this into Vercel deploy hooks (or `astro:build:done`) for automatic
 * submission on production deploys.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const HOST = process.env.INDEXNOW_HOST ?? 'millertrustguide.com';
const KEY = process.env.INDEXNOW_KEY;
const KEY_LOCATION = process.env.INDEXNOW_KEY_LOCATION ?? `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const SITEMAP_PATHS = [
  resolve('dist', 'client', 'sitemap-index.xml'),
  resolve('dist', 'client', 'sitemap-0.xml'),
];

async function readUrlsFromSitemap(path) {
  try {
    const xml = await readFile(path, 'utf8');
    const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    return [...matches].map((m) => m[1]).filter((u) => !u.endsWith('.xml'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function main() {
  if (!KEY) {
    console.error('[indexnow] INDEXNOW_KEY env var not set; skipping submission.');
    process.exit(0);
  }

  const urls = (await Promise.all(SITEMAP_PATHS.map(readUrlsFromSitemap))).flat();
  const unique = [...new Set(urls)];

  if (unique.length === 0) {
    console.error('[indexnow] No URLs found in sitemaps. Build first?');
    process.exit(1);
  }

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: unique,
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`[indexnow] ${res.status} ${res.statusText} — submitted ${unique.length} URLs`);
  if (!res.ok) {
    console.error(`[indexnow] response body: ${text}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[indexnow] failed:', err);
  process.exit(1);
});
