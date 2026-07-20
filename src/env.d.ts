/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  // Stripe
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
  readonly STRIPE_FOUNDER_COUPON_ID?: string;

  // Resend — transactional + nurture audience
  readonly RESEND_API_KEY: string;
  readonly RESEND_FROM_ADDRESS?: string;
  readonly RESEND_FROM_NAME?: string;
  readonly RESEND_AUDIENCE_ID?: string;
  readonly OPERATOR_ALERT_EMAIL?: string;

  // Vercel Blob — kit PDF storage
  readonly BLOB_READ_WRITE_TOKEN: string;

  // Signing secrets
  readonly DOWNLOAD_TOKEN_SECRET: string;
  readonly CRON_SECRET?: string;

  // B2B recurring tier
  readonly B2B_SESSION_SECRET: string;
  readonly STRIPE_B2B_BUNDLE_MONTHLY?: string;
  readonly STRIPE_B2B_BUNDLE_ANNUAL?: string;
  readonly STRIPE_PORTAL_CONFIG_ID?: string;
  readonly B2B_SESSION_TTL_MINUTES?: string;
  readonly B2B_MAGICLINK_TTL_MINUTES?: string;

  // Vercel KV (Upstash Redis) — injected by the Marketplace integration.
  // The @upstash/redis fallbacks are accepted too (UPSTASH_REDIS_REST_*).
  readonly KV_REST_API_URL?: string;
  readonly KV_REST_API_TOKEN?: string;
  readonly UPSTASH_REDIS_REST_URL?: string;
  readonly UPSTASH_REDIS_REST_TOKEN?: string;

  // Site
  readonly SITE_URL?: string;

  // Google Ads (public, non-secret)
  readonly PUBLIC_GOOGLE_ADS_ID?: string;
  readonly PUBLIC_GOOGLE_ADS_PURCHASE_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    // Set by src/middleware.ts on the authenticated /business portal page.
    b2b?: import('./lib/session-token').SessionClaims;
  }
}
