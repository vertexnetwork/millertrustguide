/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#115E59',
          dark: '#0F4C4A',
          tint: '#CCFBF1',
        },
        surface: {
          DEFAULT: '#FAFAF7',
          elevated: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#D1D5DB',
        },
        ink: {
          DEFAULT: '#1F2937',
          heading: '#0F4C4A',
          muted: '#6B7280',
        },
        cta: {
          DEFAULT: '#B45309',
          hover: '#92400E',
        },
        disclaimer: {
          bg: '#FEF3C7',
          text: '#78350F',
          border: '#FCD34D',
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
