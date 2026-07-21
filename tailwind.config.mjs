/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#115E59',
          dark: '#0F4C4A',
          // Deepened from #CCFBF1 so tint-filled callouts stay distinguishable
          // from the off-white surface on dim / blue-light-filtered screens.
          tint: '#ADEFE0',
        },
        surface: {
          DEFAULT: '#FAFAF7',
          elevated: '#FFFFFF',
        },
        border: {
          // Darkened (from #E5E7EB / #D1D5DB) so box outlines survive a warm,
          // dimmed night screen for older eyes.
          DEFAULT: '#D1D5DB',
          strong: '#9CA3AF',
        },
        ink: {
          DEFAULT: '#1F2937',
          // Greener + slightly lighter than #0F4C4A so headings read as "green,"
          // not near-black, once a blue-light filter removes the blue. ~7.6:1.
          heading: '#0A5C46',
          muted: '#6B7280',
        },
        cta: {
          DEFAULT: '#B45309',
          hover: '#92400E',
        },
        disclaimer: {
          // Slightly cleaner fill + a crisper, more saturated border so the
          // caution yellow reads sharp (not "dirty") under a warm night filter.
          bg: '#FFF7D6',
          text: '#78350F',
          border: '#E0A11E',
        },
        success: '#047857',
        warning: '#B45309',
        error: '#B91C1C',
      },
      fontFamily: {
        heading: ['Source Serif Pro', 'Charter', 'Iowan Old Style', 'Georgia', 'serif'],
        body: ['Inter', '-apple-system', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        base: ['1.125rem', { lineHeight: '1.65' }],
      },
      maxWidth: {
        prose: '72ch',
      },
    },
  },
  plugins: [],
};
