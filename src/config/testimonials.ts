// Real, permissioned customer testimonials — one honest quote per state, OFF by
// default. Same no-fabrication doctrine as SocialProof.astro and identity.ts: we
// only ever ship words a real buyer actually wrote, lightly trimmed for length —
// never paraphrased into something they didn't say, never edited to turn a caveat
// into a guarantee. Nothing renders until the operator flips `status` off 'off'.
//
// status values:
//   'off'        — render nothing (default). Use until the buyer replies.
//   'attributed' — buyer gave EXPLICIT permission to be named → render `attributed`.
//   'anonymized' — no name permission (or we chose to anonymize) → render `anonymized`,
//                  a descriptive, non-identifying label.
//
// PRIVACY: this repo is PUBLIC. Do NOT put a buyer's real name here until they have
// explicitly agreed to be named. The quote (no name in it) and the descriptive
// `anonymized.label` are safe to commit — the label is exactly what we'd publish if
// they decline. Fill `attributed.name` ONLY at flip time, together with setting
// `status: 'attributed'`. If `status` is 'attributed' but the name is still blank,
// the component falls back to the anonymized rendering (see Testimonial.astro).

export type TestimonialStatus = 'off' | 'attributed' | 'anonymized';

export interface Testimonial {
  stateSlug: string;
  status: TestimonialStatus;
  // The buyer's OWN words, lightly trimmed. Rendered verbatim as the pull-quote.
  quote: string;
  // Shown when status === 'attributed'. name is intentionally blank in the public
  // repo until the buyer consents to being named (see PRIVACY note above).
  attributed: { name: string; credential: string; location: string };
  // Shown when status === 'anonymized'. Descriptive, non-identifying.
  anonymized: { label: string };
}

export const TESTIMONIALS: Testimonial[] = [
  {
    stateSlug: 'new-jersey',
    // Gary approved the quote on 2026-07-13 but asked us NOT to use his name, so
    // this is 'anonymized' (renders anonymized.label, never the name). See
    // docs/customer-feedback-log.md.
    status: 'anonymized',
    // Trimmed from Gary's 2026-07-09 reply (full verbatim text in
    // docs/customer-feedback-log.md). Confirm this exact wording in the permission
    // ask so what ships is what he signed off on.
    quote:
      "Your Setup Kit turned out to be extremely useful. It got us to the New Jersey QIT template right away — and that was big. We used the Kit to work through the template and the practical questions about how a QIT actually works, and we were able to draft it, get it executed, open a bank account, and submit it with the application in just two or three days. It was an essential need for us, and the Kit helped us accomplish it very quickly.",
    attributed: {
      name: '', // ← fill ONLY with explicit consent to be named, at flip time
      credential: 'Retired attorney & CPA',
      location: 'New Jersey',
    },
    anonymized: {
      // Gary's approved descriptor (2026-07-13), verbatim intent. State is omitted
      // here because the component's "Verified <state> buyer" badge already carries
      // it — avoids rendering "New Jersey" twice.
      label: 'Retired attorney & CPA',
    },
  },
];

// Returns the testimonial to render for a state, or null when there is none or it
// is still switched off. Callers gate on isLive as well (draft/blocked states show
// no testimonial).
export function getTestimonial(stateSlug: string): Testimonial | null {
  const t = TESTIMONIALS.find((x) => x.stateSlug === stateSlug);
  if (!t || t.status === 'off') return null;
  return t;
}

// Every switched-on testimonial, in config order — for the home page proof grid,
// which shows brand-level proof across states (one entry powers both its state page
// and the home page). Grows automatically as states are added and flipped on. The
// caller resolves each stateSlug to a display name and drops any non-live state.
export function getEnabledTestimonials(): Testimonial[] {
  return TESTIMONIALS.filter((t) => t.status !== 'off');
}
