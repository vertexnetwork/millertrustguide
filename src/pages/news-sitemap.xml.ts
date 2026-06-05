// Google News sitemap, served at /news-sitemap.xml.
//
// IMPORTANT scope note: a News sitemap may ONLY list articles published or
// substantively updated within the last 2 days (Google News requirement), and
// it only does anything once the site is accepted in Google News / the
// Publisher Center. This site is evergreen reference content, so on most days
// this sitemap is intentionally EMPTY — it activates only in the 48h after a
// state guide is freshly published or its annual figures are revised. Listing
// stale evergreen pages here would violate the News guidelines, so we don't.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://millertrustguide.com';
const PUBLICATION_NAME = 'Miller Trust Guide';
const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 48h

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const now = Date.now();
  const states = await getCollection('states');

  const fresh = states
    .filter((s) => s.data.status === 'live' && s.data.reviewedDate)
    .map((s) => ({
      slug: s.slug,
      title: s.data.metaTitle,
      reviewed: s.data.reviewedDate,
      ts: Date.parse(`${s.data.reviewedDate}T00:00:00Z`),
    }))
    .filter((s) => Number.isFinite(s.ts) && now - s.ts <= NEWS_WINDOW_MS);

  const urls = fresh
    .map(
      (s) => `  <url>
    <loc>${xmlEscape(`${SITE}/states/${s.slug}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(PUBLICATION_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${s.reviewed}T00:00:00Z</news:publication_date>
      <news:title>${xmlEscape(s.title)}</news:title>
    </news:news>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=900',
    },
  });
};
