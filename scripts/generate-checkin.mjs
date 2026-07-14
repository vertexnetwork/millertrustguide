#!/usr/bin/env node
/**
 * Generate a personalized post-purchase check-in email for ONE buyer, ready for
 * the operator to review and send by hand.
 *
 * This is the human-in-the-loop version of the check-in that will later be
 * automated (webhook/cron). Firing it manually first lets us validate the two
 * things that make it work: it is personalized (not generic), and it is TIMED so
 * the buyer has had a few days to actually use the kit before we ask how it went.
 * That combination is what earned our first detailed feedback.
 *
 * The email keeps the personal reply-to touch AND offers the 2-minute feedback
 * form (/feedback) as a low-friction alternative.
 *
 * Usage:
 *   node scripts/generate-checkin.mjs --state new-jersey --name Gary --date 2026-07-09 [--order cs_123]
 *
 * No em dashes in the email body (operator preference: they read as AI-written).
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://millertrustguide.com';
const SEND_OFFSET_DAYS = 2; // send ~2 days after purchase: time to use it, still fresh

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : '';
}

const slug = arg('state').toLowerCase();
const firstName = arg('name') || 'there';
const purchaseDate = arg('date'); // YYYY-MM-DD
const order = arg('order');

if (!slug || !purchaseDate) {
  console.error(
    'Usage: node scripts/generate-checkin.mjs --state <slug> --date <YYYY-MM-DD> [--name <first>] [--order <id>]'
  );
  process.exit(1);
}

const mdxPath = join(ROOT, 'src/content/states', `${slug}.mdx`);
let mdx;
try {
  mdx = readFileSync(mdxPath, 'utf8');
} catch {
  console.error(`No state file at src/content/states/${slug}.mdx`);
  process.exit(1);
}
const field = (name) => new RegExp(`^${name}:\\s*"?([^"\\n]+)"?`, 'm').exec(mdx)?.[1]?.trim();

const stateName = field('name');
const agency = field('agencyAbbreviation');
const instrument = field('primaryTerm') || 'Qualified Income Trust';
if (!stateName) {
  console.error(`Could not read the state name from ${slug}.mdx`);
  process.exit(1);
}

// Suggested send date = purchase date + offset. Pure date math (no clock needed).
const d = new Date(`${purchaseDate}T12:00:00Z`);
if (isNaN(d.getTime())) {
  console.error(`--date "${purchaseDate}" is not a valid YYYY-MM-DD date.`);
  process.exit(1);
}
d.setUTCDate(d.getUTCDate() + SEND_OFFSET_DAYS);
const sendDate = d.toISOString().slice(0, 10);

const formLink = `${SITE}/feedback?state=${slug}${order ? `&order=${encodeURIComponent(order)}` : ''}`;

const subject = `Quick check-in on your ${stateName} kit`;

const body = `Hi ${firstName},

I'm James, the researcher behind Miller Trust Guide. You bought the ${stateName} kit a couple of days ago, so I wanted to check in now that you've had a chance to open it and start working through it.

Two quick things, and honest answers are the most useful kind:

1. Did the kit reach you and open OK? If the download gave you any trouble, just reply and I'll sort it out right away.

2. Is the walkthrough clear enough to actually act on? The whole point is to make ${stateName}'s own ${instrument} form feel doable. If any step slowed you down or left you unsure, I would genuinely like to know, because it usually means the next family will hit the same spot.

If a short form is easier than a reply, here is a two-minute one: ${formLink}

One note so I stay in my lane: the kit explains how to use ${stateName}'s official published form, so I can't advise on your specific situation. For that, a ${stateName} elder-law attorney or your ${agency ? agency : 'state Medicaid'} office is the right call. But for anything about the kit itself, I'm right here.

Thank you for taking a chance on something new. It genuinely means a lot.
`;

const out = `============================================================
CHECK-IN EMAIL  (review, then send by hand)
============================================================
Buyer state:   ${stateName}
Purchase date: ${purchaseDate}
SEND ON/AFTER: ${sendDate}   (${SEND_OFFSET_DAYS} days post-purchase, so they've used it)
${order ? `Order:         ${order}\n` : ''}Feedback link: ${formLink}
------------------------------------------------------------
Subject: ${subject}
------------------------------------------------------------
${body}------------------------------------------------------------
Signature is auto-appended by the mailbox (see docs/customer-email-templates.md).
============================================================
`;

console.log(out);
