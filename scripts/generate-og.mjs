#!/usr/bin/env node
/**
 * Generate the brand raster assets from SVG sources.
 *
 *   /public/og-default.png            1200×630
 *   /public/og/states/{slug}.png      1200×630 per live state
 *   /public/apple-touch-icon.png      180×180
 *   /public/icon-192.png              192×192
 *   /public/icon-512.png              512×512
 *   /public/icon-maskable-512.png     512×512 (extra inner padding for Android masking)
 *
 * Uses @resvg/resvg-js (pure-Rust SVG → PNG; no native libvips dependency).
 *
 * Re-run after the brand or any state's 2026 figures change. Commits the
 * resulting PNGs so production never depends on this script running.
 *
 *   npm run og:generate
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = resolve(ROOT, 'public');

// --- Design tokens (must match docs/ENGINEERING_SPEC.md § Design language) --
const TEAL = '#115E59';
const TEAL_DARK = '#0F4C4A';
const BG = '#FAFAF7';
const MINT = '#CCFBF1';
const INK = '#1F2937';
const INK_MUTED = '#6B7280';
const BORDER = '#E5E7EB';

const SERIF = "'Source Serif Pro', 'Charter', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', 'Segoe UI', -apple-system, system-ui, sans-serif";

// --- Favicon monogram (the same mark used in /public/favicon.svg) -----------
function monogramSvg(size, padding = 0) {
  const inner = size - padding * 2;
  const rx = Math.round(inner * 0.156); // ~10/64
  const frameInset = Math.round(inner * 0.078); // ~5/64
  const frameSize = inner - frameInset * 2;
  const frameRx = Math.round(inner * 0.094); // ~6/64
  const fontSize = Math.round(inner * 0.656); // ~42/64
  const textY = padding + Math.round(inner * 0.734); // baseline
  const textX = padding + inner / 2;
  return `
  <rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${rx}" fill="${TEAL}"/>
  <rect x="${padding + frameInset}" y="${padding + frameInset}" width="${frameSize}" height="${frameSize}" rx="${frameRx}" fill="none" stroke="${BG}" stroke-opacity="0.16" stroke-width="${Math.max(0.5, inner * 0.012)}"/>
  <text x="${textX}" y="${textY}" font-family="${SERIF}" font-size="${fontSize}" font-weight="700" fill="${BG}" text-anchor="middle" letter-spacing="-1">M</text>`;
}

function iconStandaloneSvg(size, padding = 0) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
${monogramSvg(size, padding)}
</svg>`;
}

// --- OG image (1200×630) ----------------------------------------------------
// Layout: thin teal bars top/bottom, brand mark + monogram across the top,
// large serif headline (left), then a single data line and a footer small-caps
// line. No gradients, no decoration, no photos. Institutional.

function ogSvg({ headlineLines, dataLine, footerLine }) {
  const W = 1200;
  const H = 630;
  const PAD_L = 80;
  const BAR = 6;

  // Brand mark across the top
  const brandY = 110;
  const dividerY = 132;

  // Monogram in the top-right corner — 96×96
  const monoSize = 96;
  const monoX = W - PAD_L - monoSize;
  const monoY = 42;

  // Headline starts at y=240; each line +94px
  const headlineYStart = 250;
  const headlineLineHeight = 94;
  const headlineTSpans = headlineLines
    .map((line, i) => `<tspan x="${PAD_L}" dy="${i === 0 ? 0 : headlineLineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

  // Data line just under the headline
  const dataY = headlineYStart + headlineLineHeight * headlineLines.length + 40;

  // Footer small-caps near the bottom
  const footerY = H - BAR - 36;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- Top + bottom teal hairlines (institutional frame) -->
  <rect x="0" y="0" width="${W}" height="${BAR}" fill="${TEAL}"/>
  <rect x="0" y="${H - BAR}" width="${W}" height="${BAR}" fill="${TEAL}"/>

  <!-- Brand publication mark -->
  <text x="${PAD_L}" y="${brandY}" font-family="${SERIF}" font-size="26" font-weight="700" fill="${TEAL_DARK}" letter-spacing="6">MILLER TRUST GUIDE</text>
  <line x1="${PAD_L}" y1="${dividerY}" x2="${PAD_L + 280}" y2="${dividerY}" stroke="${TEAL}" stroke-width="1.5"/>

  <!-- Monogram in top-right -->
  <g transform="translate(${monoX} ${monoY})">
${monogramSvg(monoSize, 0)}
  </g>

  <!-- Headline -->
  <text x="${PAD_L}" y="${headlineYStart}" font-family="${SERIF}" font-size="84" font-weight="700" fill="${TEAL_DARK}">${headlineTSpans}</text>

  <!-- Data line -->
  <text x="${PAD_L}" y="${dataY}" font-family="${SANS}" font-size="28" font-weight="500" fill="${INK}">${escapeXml(dataLine)}</text>

  <!-- Thin rule above footer -->
  <line x1="${PAD_L}" y1="${footerY - 22}" x2="${W - PAD_L}" y2="${footerY - 22}" stroke="${BORDER}" stroke-width="1"/>

  <!-- Footer small caps -->
  <text x="${PAD_L}" y="${footerY}" font-family="${SANS}" font-size="18" font-weight="600" fill="${INK_MUTED}" letter-spacing="3">${escapeXml(footerLine)}</text>
</svg>`;
}

function escapeXml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// --- Asset manifest ---------------------------------------------------------
const ASSETS = [
  // PWA + Apple icons (rasterized from the same monogram mark)
  {
    path: 'apple-touch-icon.png',
    svg: iconStandaloneSvg(180, 0),
    width: 180,
  },
  {
    path: 'icon-192.png',
    svg: iconStandaloneSvg(192, 0),
    width: 192,
  },
  {
    path: 'icon-512.png',
    svg: iconStandaloneSvg(512, 0),
    width: 512,
  },
  // Maskable variant — Android masks the icon; safe-zone is the inner 80%.
  // Add 12.5% padding so the M sits inside the safe circle.
  {
    path: 'icon-maskable-512.png',
    svg: iconStandaloneSvg(512, 64),
    width: 512,
  },

  // OG default
  {
    path: 'og-default.png',
    svg: ogSvg({
      headlineLines: ['State-specific guides for', 'Medicaid Qualified', 'Income Trusts.'],
      dataLine: '24 income-cap states  ·  2026 income cap: $2,982/mo  ·  $129 per state',
      footerLine: 'LAST REVIEWED 2026-05-20    ·    INFORMATIONAL ONLY    ·    NOT LEGAL ADVICE',
    }),
    width: 1200,
  },

  // OG per-state — Texas
  {
    path: 'og/states/texas.png',
    svg: ogSvg({
      headlineLines: ['Texas Miller Trust', 'Setup Guide'],
      dataLine: '$129  ·  2026 income cap: $2,982/mo  ·  Money-back if HHSC rejects',
      footerLine: 'TEXAS HHSC  ·  APPENDIX XXXVI REV 26-1  ·  LAST REVIEWED 2026-05-21',
    }),
    width: 1200,
  },

  // OG per-state — New Jersey
  {
    path: 'og/states/new-jersey.png',
    svg: ogSvg({
      headlineLines: ['New Jersey Miller', 'Trust Setup Guide'],
      dataLine: '$129  ·  2026 income cap: $2,982/mo  ·  Money-back if DMAHS rejects',
      footerLine: 'NJ DMAHS  ·  QIT MODEL INSTRUMENT  ·  LAST REVIEWED 2026-06-01',
    }),
    width: 1200,
  },

  // OG per-state — Ohio
  {
    path: 'og/states/ohio.png',
    svg: ogSvg({
      headlineLines: ['Ohio Miller Trust', 'Setup Guide'],
      dataLine: '$129  ·  2026 income cap: $2,982/mo  ·  Money-back if ODM rejects',
      footerLine: 'OHIO ODM  ·  OAC 5160:1-6-03.2  ·  LAST REVIEWED 2026-06-23',
    }),
    width: 1200,
  },

  // OG per-state — Georgia
  {
    path: 'og/states/georgia.png',
    svg: ogSvg({
      headlineLines: ['Georgia Qualified', 'Income Trust Guide'],
      dataLine: '$129  ·  2026 income cap: $2,982/mo  ·  Money-back if DCH rejects',
      footerLine: 'GEORGIA DCH  ·  DFCS SECTION 2407 · FORM 948  ·  LAST REVIEWED 2026-06-23',
    }),
    width: 1200,
  },

  // OG per-state — South Carolina
  {
    path: 'og/states/south-carolina.png',
    svg: ogSvg({
      headlineLines: ['South Carolina', 'Income Trust Guide'],
      dataLine: '$129  ·  2026 income cap: $2,982/mo  ·  Money-back if SCDHHS rejects',
      footerLine: 'SC SCDHHS  ·  DHHS FORM 905  ·  LAST REVIEWED 2026-06-24',
    }),
    width: 1200,
  },

  // OG per-state — Indiana
  {
    path: 'og/states/indiana.png',
    svg: ogSvg({
      headlineLines: ['Indiana Miller', 'Trust Setup Guide'],
      dataLine: '$129  ·  2026 income cap: $2,982/mo  ·  Money-back if FSSA rejects',
      footerLine: 'INDIANA FSSA  ·  405 IAC 2-3-29 · MILLER TRUST  ·  LAST REVIEWED 2026-06-26',
    }),
    width: 1200,
  },
];

async function renderOne({ path, svg, width }) {
  const out = resolve(PUBLIC, path);
  await mkdir(dirname(out), { recursive: true });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      // Walk the system font directories for matching font-family.
      loadSystemFonts: true,
      defaultFontFamily: 'Georgia',
    },
    background: 'transparent',
  });
  const png = resvg.render().asPng();
  await writeFile(out, png);
  console.log(`✓ ${path}  (${png.byteLength.toLocaleString()} bytes)`);
}

async function main() {
  console.log(`Rendering ${ASSETS.length} brand assets into ${PUBLIC}…`);
  for (const asset of ASSETS) {
    await renderOne(asset);
  }
  console.log('All brand assets rendered.');
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
