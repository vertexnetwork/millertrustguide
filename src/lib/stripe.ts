import Stripe from 'stripe';

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
