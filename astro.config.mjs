import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
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
    // XML sitemap is hand-rolled at src/pages/sitemap.xml.ts so it lives at
    // /sitemap.xml (the @astrojs/sitemap integration hardcodes the
    // sitemap-index.xml + sitemap-0.xml filenames).
  ],
  prefetch: { defaultStrategy: 'hover' },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    ssr: {
      // Stripe SDK and Resend are Node-only; keep them server-side.
      external: ['stripe', 'resend', '@vercel/blob'],
    },
  },
});
