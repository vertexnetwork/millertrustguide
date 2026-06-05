// RSS 2.0 feed served at /rss.xml. The "items" are the state guides (the
// site's actual content units) plus a stable channel describing the
// publication. Feed readers, news aggregators, and several AI ingestion
// pipelines discover content this way. Drafts are excluded.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://millertrustguide.com';
const TITLE = 'Miller Trust Guide';
const DESCRIPTION =
  'State-specific operational guides for setting up a Medicaid Qualified Income Trust (Miller Trust). Informational, not legal advice.';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(dateStr?: string): string {
  const d = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toUTCString();
}

export const GET: APIRoute = async () => {
  const states = (await getCollection('states'))
    .filter((s) => s.data.status !== 'draft')
    .map((s) => ({ ...s.data, slug: s.slug }))
    .sort((a, b) => (b.reviewedDate || '').localeCompare(a.reviewedDate || ''));

  const lastBuild = rfc822(states[0]?.reviewedDate);

  const items = states
    .map((s) => {
      const url = `${SITE}/states/${s.slug}`;
      return `    <item>
      <title>${xmlEscape(s.metaTitle)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${rfc822(s.reviewedDate)}</pubDate>
      <description>${xmlEscape(s.metaDescription)}</description>
      <category>${xmlEscape(s.name)}</category>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(TITLE)}</title>
    <link>${SITE}/</link>
    <description>${xmlEscape(DESCRIPTION)}</description>
    <language>en-US</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
