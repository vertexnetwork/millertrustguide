import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://millertrustguide.com',
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: true },
    imageService: true,
  }),
  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/api/') &&
        !page.includes('/thanks') &&
        !page.includes('/admin') &&
        !page.includes('/draft'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        // State pages and the homepage are the highest-priority surfaces.
        if (item.url === 'https://millertrustguide.com/') {
          return { ...item, priority: 1.0, changefreq: 'weekly' };
        }
        if (item.url.includes('/states/')) {
          return { ...item, priority: 0.9, changefreq: 'weekly' };
        }
        if (item.url.includes('/authors/') || item.url.includes('/editorial-process')) {
          return { ...item, priority: 0.6, changefreq: 'monthly' };
        }
        if (
          item.url.includes('/disclaimer') ||
          item.url.includes('/privacy') ||
          item.url.includes('/refund-policy')
        ) {
          return { ...item, priority: 0.3, changefreq: 'yearly' };
        }
        return item;
      },
    }),
  ],
  prefetch: { defaultStrategy: 'hover' },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    ssr: {
      // Stripe SDK and Postmark are Node-only; keep them server-side.
      external: ['stripe', 'postmark', '@vercel/blob'],
    },
  },
});
