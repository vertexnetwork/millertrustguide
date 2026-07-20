// Shared resolver for the brand-level proof stack (home grid + every state page).
//
// Each switched-on testimonial is resolved to ITS OWN state's display name so its
// "Verified <state> buyer" badge always tells the truth — a New Jersey buyer's
// quote shown on the Texas page is labeled "Verified New Jersey buyer", never
// "Verified Texas buyer". That honest cross-state framing is what lets one real
// testimonial provide proof site-wide until each state earns its own (see
// src/config/testimonials.ts for the no-fabrication doctrine).

import { getCollection } from 'astro:content';
import { getEnabledTestimonials, type Testimonial } from '~/config/testimonials';

export interface ResolvedTestimonial {
  testimonial: Testimonial;
  /** The testimonial's OWN state display name — drives the honest badge. */
  stateName: string;
}

/**
 * Every switched-on testimonial whose state is live, each paired with its own
 * state's display name. Empty when none are switched on (config is 'off' by
 * default) so callers can gate the whole section out.
 */
export async function getResolvedTestimonials(): Promise<ResolvedTestimonial[]> {
  const states = await getCollection('states');
  const bySlug = new Map(states.map((s) => [s.slug, s] as const));
  return getEnabledTestimonials().flatMap((testimonial) => {
    const s = bySlug.get(testimonial.stateSlug);
    return s && s.data.status === 'live' ? [{ testimonial, stateName: s.data.name }] : [];
  });
}

/**
 * Order the proof stack for a specific state page: that state's own
 * testimonial(s) first (so a buyer sees their own state when it exists), then
 * the rest, capped at `limit` (default 6).
 */
export function orderForState(
  all: ResolvedTestimonial[],
  stateSlug: string,
  limit = 6
): ResolvedTestimonial[] {
  const own = all.filter((t) => t.testimonial.stateSlug === stateSlug);
  const others = all.filter((t) => t.testimonial.stateSlug !== stateSlug);
  return [...own, ...others].slice(0, limit);
}
