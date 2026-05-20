# IndexNow integration

IndexNow is the push protocol that Bing, Yandex, DuckDuckGo, Seznam, Naver,
and Yep use to fetch new/updated URLs within hours rather than waiting for
their crawler schedule. Google does NOT consume IndexNow (as of 2026).

## Setup

1. Generate a 32-character hex key (e.g., `openssl rand -hex 16`) and store
   it in the Vercel project as `INDEXNOW_KEY`. Do not commit the key file
   itself.
2. Add the key file to this `public/` directory at the path
   `{key}.txt` whose contents are the key itself.
   Example: `public/abc123…ef.txt` containing the single line `abc123…ef`.
3. The `scripts/indexnow-submit.mjs` script reads the built sitemap and
   POSTs new/updated URLs to `https://api.indexnow.org/IndexNow` on every
   production deploy. Wire it up with a Vercel deploy hook or a post-build
   step in package.json.
4. Add a one-time submission in Bing Webmaster Tools to confirm the key
   file resolves.

## Why ship this

- 22% of clicked Bing URLs in February 2026 came from IndexNow-submitted
  sources, per Bing public stats.
- Persona B (community-spouse, age 70+) is over-indexed on Bing search.
- Indexing-speed advantage: hours vs. days, especially for the long-tail
  state-specific pages that compound into ranking authority.
