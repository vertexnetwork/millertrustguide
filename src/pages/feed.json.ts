// JSON Feed 1.1 served at /feed.json — the modern JSON counterpart of
// /rss.xml (spec: https://www.jsonfeed.org/version/1.1/). Same items (the
// state guides). Some readers and AI ingestion pipelines prefer JSON.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const SITE = 'https://millertrustguide.com';

export const GET: APIRoute = async () => {
  const states = (await getCollection('states'))
    .filter((s) => s.data.status !== 'draft')
    .map((s) => ({ ...s.data, slug: s.slug }))
    .sort((a, b) => (b.reviewedDate || '').localeCompare(a.reviewedDate || ''));

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Miller Trust Guide',
    home_page_url: `${SITE}/`,
    feed_url: `${SITE}/feed.json`,
    description:
      'State-specific operational guides for setting up a Medicaid Qualified Income Trust (Miller Trust). Informational, not legal advice.',
    language: 'en-US',
    authors: [{ name: 'James Whitfield', url: `${SITE}/authors/james-whitfield` }],
    items: states.map((s) => ({
      id: `${SITE}/states/${s.slug}`,
      url: `${SITE}/states/${s.slug}`,
      title: s.metaTitle,
      summary: s.metaDescription,
      content_text: s.metaDescription,
      date_published: `${s.reviewedDate}T00:00:00Z`,
      date_modified: `${s.reviewedDate}T00:00:00Z`,
      tags: [s.name, 'Qualified Income Trust', 'Medicaid'],
      image: `${SITE}/og/states/${s.slug}.png`,
    })),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/feed+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
