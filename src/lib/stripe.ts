import Stripe from 'stripe';
import { FOUNDER } from '~/config/founder';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const secret = import.meta.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured.');
  cached = new Stripe(secret, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });
  return cached;
}

export function getWebhookSecret(): string {
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  return secret;
}

export interface FounderStatus {
  unitsSold: number;
  unitLimit: number;
  spotsLeft: number;
  founderActive: boolean;
  founderPrice: number;
}

// Live founder-offer status derived from the Stripe coupon's `times_redeemed`
// (the same number that hard-enforces the discount in create-checkout.ts).
// Never throws: on a missing coupon id or a Stripe error it falls back to the
// static FOUNDER.unitsSold, so a build or a request can't break on it.
export async function getFounderStatus(): Promise<FounderStatus> {
  let unitsSold = FOUNDER.unitsSold;
  const couponId = import.meta.env.STRIPE_FOUNDER_COUPON_ID;
  if (couponId) {
    try {
      const coupon = await getStripe().coupons.retrieve(couponId);
      if (typeof coupon.times_redeemed === 'number') unitsSold = coupon.times_redeemed;
    } catch (err) {
      console.error('[founder] coupon lookup failed; using static fallback:', err);
    }
  }
  const spotsLeft = Math.max(0, FOUNDER.unitLimit - unitsSold);
  return {
    unitsSold,
    unitLimit: FOUNDER.unitLimit,
    spotsLeft,
    founderActive: spotsLeft > 0,
    founderPrice: FOUNDER.price,
  };
}
