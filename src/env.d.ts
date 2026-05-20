/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
  readonly POSTMARK_SERVER_TOKEN: string;
  readonly POSTMARK_FROM_ADDRESS: string;
  readonly POSTMARK_FROM_NAME: string;
  readonly BLOB_READ_WRITE_TOKEN: string;
  readonly SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
