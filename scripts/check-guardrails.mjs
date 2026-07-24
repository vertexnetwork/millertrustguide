#!/usr/bin/env node
// Rule 1, 2, 3 enforcement as CI gates. Fails the build (exit 1) if any
// guardrail is violated. Run as `npm run lint:guardrails`. Wire into a
// GitHub Actions check to run on every PR before merge.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const CONTENT = join(ROOT, 'src', 'content');

// --- Rule 1: no drafted trust-instrument prose in shipped content -----------
// Forbidden phrases that would imply we authored trust text.
const FORBIDDEN_CONTENT_PHRASES = [
  /trust template:/i,
  /\bWITNESSETH\b/,
  /\bthis trust shall be\b/i,
  /\bthe trustee hereby\b/i,
  /\bGRANTOR\s+hereby\b/,
  /\bIN WITNESS WHEREOF\b/i,
  /\barticle\s+(one|two|three|i|ii|iii|iv)\b.*\btrust\b/i,
];

// --- Rule 1: officialTemplateUrl must be on a .gov / .us domain --------------
const GOV_DOMAIN_RE = /^https?:\/\/[a-z0-9.-]+\.(gov|us)(\/|$)/i;

// --- Rule 2: no PII intake form fields ---------------------------------------
const PII_FIELD_NAMES = /(name|value|id)\s*[:=]\s*['"](income|age|date_of_birth|dob|ssn|family|spouse|situation|condition|household)['"]/i;

// --- Rule 3: no phone numbers outside allowlist -----------------------------
// Allowlist: state agency contact reference numbers can appear in /docs/
// (which is gitignored anyway) and in clearly-labeled agency-citation blocks.
const PHONE_RE = /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

// --- Rule 3: no live-chat widget vendors ------------------------------------
const FORBIDDEN_VENDORS = [
  /intercom\.io/i,
  /widget\.intercom/i,
  /crisp\.chat/i,
  /drift\.com/i,
  /tawk\.to/i,
  /freshchat/i,
];

let failures = 0;

function fail(file, rule, line, snippet) {
  failures++;
  console.error(`✗ ${relative(ROOT, file)}  [${rule}]  line ${line}: ${snippet}`);
}

function walk(dir, exts) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist' || entry === '.astro') continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p, exts));
    else if (exts.includes(extname(p))) out.push(p);
  }
  return out;
}

function checkLines(file, regexes, ruleName) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const r of regexes) {
      if (r.test(line)) fail(file, ruleName, i + 1, line.trim().slice(0, 120));
    }
  });
}

// 1. Forbidden trust-instrument prose in content files
for (const file of walk(CONTENT, ['.mdx', '.md'])) {
  checkLines(file, FORBIDDEN_CONTENT_PHRASES, 'Rule 1 — forbidden trust-instrument prose');
}

// 2. Every state file's officialTemplateUrl must be on a .gov / .us domain.
// 'requirements-brief' states (productModel) have no official fill-in
// instrument by design — no state publishes one — so they legitimately omit
// officialTemplateUrl entirely; skip the requirement for those only.
for (const file of walk(join(CONTENT, 'states'), ['.mdx', '.md'])) {
  const text = readFileSync(file, 'utf8');
  const productModelMatch = text.match(/productModel:\s*["']?([a-z-]+)["']?/);
  const productModel = productModelMatch ? productModelMatch[1] : 'template';
  if (productModel === 'requirements-brief') continue;

  const match = text.match(/officialTemplateUrl:\s*["']?([^"'\n\r]+)["']?/);
  if (!match) {
    fail(file, 'Rule 1 — missing officialTemplateUrl', 0, '');
    continue;
  }
  const url = match[1].trim();
  if (!GOV_DOMAIN_RE.test(url)) {
    fail(file, 'Rule 1 — officialTemplateUrl not on .gov/.us domain', 0, url);
  }
}

// 3. PII-form-field name attributes in .astro / .tsx / .ts / .jsx
for (const file of walk(SRC, ['.astro', '.tsx', '.ts', '.jsx', '.js'])) {
  // Skip the guardrail script itself and the lib helpers that string-match these tokens.
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  if (rel.startsWith('scripts/')) continue;
  checkLines(file, [PII_FIELD_NAMES], 'Rule 2 — PII intake field name forbidden');
}

// 4. Phone numbers in shipped code or content. Allow inside /docs/ (gitignored).
for (const file of walk(SRC, ['.astro', '.tsx', '.ts', '.mdx', '.md', '.jsx', '.js'])) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const match = PHONE_RE.exec(line);
    PHONE_RE.lastIndex = 0; // stateless re-use (no /g flag, but be defensive)
    if (match) {
      // Allowlist: lines that explicitly describe state-agency contact references.
      if (/agency contact|state bar|agency reference/i.test(line)) return;
      // Allowlist: a digit run immediately preceded by a URL path separator
      // (e.g. .../lnx/0501120203) is a URL path segment, not a phone number —
      // a real phone number is never written as a bare "/XXXXXXXXXX" path.
      if (line[match.index - 1] === '/') return;
      fail(file, 'Rule 3 — phone number in shipped code/content', i + 1, line.trim().slice(0, 120));
    }
  });
}

// 5. Forbidden live-chat vendor scripts
for (const file of walk(SRC, ['.astro', '.tsx', '.ts', '.html', '.jsx', '.js'])) {
  checkLines(file, FORBIDDEN_VENDORS, 'Rule 3 — live-chat vendor forbidden');
}

if (failures > 0) {
  console.error(`\n${failures} guardrail violation(s). Build fails.`);
  process.exit(1);
}
console.log('✓ All 4 hard-rule guardrails pass.');
