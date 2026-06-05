// Hand-rolled XML sitemap served at /sitemap.xml.
//
// We do not use @astrojs/sitemap: that integration hardcodes a
// sitemap-index.xml + sitemap-0.xml pair and offers no way to rename them.
// A flat single sitemap.xml is also correct for a site this size — the
// index layer only matters past the 50,000-URL-per-file limit.
//
// Adding a new static page means adding a line to STATIC_ROUTES below.
// State pages are enumerated automatically from the content collection.
//
// Image sitemap: per Google's image-sitemap guidance we declare images
// inline on their containing <url> with the image: namespace (a separate
// image sitemap file is not needed and is the older pattern). Each live state
// page advertises its kit cover-preview and per-state OG card.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://millertrustguide.com';

type ChangeFreq = 'weekly' | 'monthly' | 'yearly';

interface SitemapEntry {
  path: string;
  priority: number;
  changefreq: ChangeFreq;
  lastmod: string;
  images?: string[];
}

const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Static routes. Excludes /api/*, /thanks, /404, and /kits/* by omission —
// those are intentionally not in the sitemap.
const STATIC_ROUTES: Omit<SitemapEntry, 'lastmod'>[] = [
  { path: '/', priority: 1.0, changefreq: 'weekly', images: [`${SITE}/og-default.png`] },
  { path: '/about', priority: 0.6, changefreq: 'monthly' },
  { path: '/editorial-process', priority: 0.6, changefreq: 'monthly' },
  { path: '/authors/james-whitfield', priority: 0.6, changefreq: 'monthly' },
  { path: '/sitemap', priority: 0.3, changefreq: 'monthly' },
  { path: '/disclaimer', priority: 0.3, changefreq: 'yearly' },
  { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
  { path: '/refund-policy', priority: 0.3, changefreq: 'yearly' },
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const states = await getCollection('states');

  const entries: SitemapEntry[] = [
    ...STATIC_ROUTES.map((r) => ({ ...r, lastmod: BUILD_DATE })),
    // State pages — exclude drafts (they render noindex; a noindex page
    // does not belong in the sitemap).
    ...states
      .filter((s) => s.data.status !== 'draft')
      .map((s) => ({
        path: `/states/${s.slug}`,
        priority: 0.9,
        changefreq: 'weekly' as ChangeFreq,
        lastmod: s.data.reviewedDate || BUILD_DATE,
        // Per-state OG card + kit cover preview (live states only — the cover
        // preview asset is generated for purchasable kits).
        images:
          s.data.status === 'live'
            ? [`${SITE}/og/states/${s.slug}.png`, `${SITE}/kit-previews/${s.slug}/01-cover.png`]
            : [`${SITE}/og/states/${s.slug}.png`],
      })),
  ];

  const urls = entries
    .map((e) => {
      const imageTags = (e.images ?? [])
        .map((img) => `    <image:image>\n      <image:loc>${xmlEscape(img)}</image:loc>\n    </image:image>`)
        .join('\n');
      return `  <url>
    <loc>${xmlEscape(SITE + e.path)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>${imageTags ? '\n' + imageTags : ''}
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
