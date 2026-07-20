// Minimal KV (Upstash Redis) for the B2B tier.
//
// This is NOT a system of record — Stripe is the source of truth for who has
// an active subscription. KV holds only ephemeral plumbing, all TTL'd:
//   - magic-link single-use nonces  (burn on first use)
//   - login rate-limit counters     (stop email-bomb + enumeration)
//   - short entitlement-status cache (decouple portal loads from Stripe)
//
// Provisioned via Vercel → Storage → Marketplace → Upstash for Redis, which
// injects KV_REST_API_URL / KV_REST_API_TOKEN (the standalone @upstash/redis
// UPSTASH_REDIS_REST_* names are accepted as a fallback). When UNCONFIGURED,
// every call degrades to a safe no-op (logged once) so local dev and the
// pre-provision window still work — links just aren't single-use and login
// isn't rate-limited until the store exists. Dynamic import keeps the SDK off
// the SSR bundle boundary (mirrors src/lib/blob.ts).

interface RedisLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

function creds(): { url: string; token: string } | null {
  const url = import.meta.env.KV_REST_API_URL || import.meta.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.KV_REST_API_TOKEN || import.meta.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function isKvConfigured(): boolean {
  return creds() !== null;
}

// undefined = not yet initialised; null = confirmed unconfigured.
let cached: RedisLike | null | undefined;
let warned = false;

async function getRedis(): Promise<RedisLike | null> {
  if (cached !== undefined) return cached;
  const c = creds();
  if (!c) {
    if (!warned) {
      console.warn(
        '[kv] Vercel KV / Upstash Redis is not configured — magic links are NOT single-use and login is NOT rate-limited. Provision it before production B2B launch.'
      );
      warned = true;
    }
    cached = null;
    return null;
  }
  const { Redis } = await import('@upstash/redis');
  cached = new Redis({ url: c.url, token: c.token }) as unknown as RedisLike;
  return cached;
}

/** Read a JSON value. Returns null if absent or KV is unavailable. */
export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const r = await getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return (v ?? null) as T | null;
  } catch (err) {
    console.error('[kv] get failed:', err);
    return null;
  }
}

/** Write a JSON value with a TTL (seconds). No-op if KV is unavailable. */
export async function kvSetJSON(key: string, value: unknown, ttlSec: number): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: ttlSec });
  } catch (err) {
    console.error('[kv] set failed:', err);
  }
}

/** Delete a key. Returns true if a key was removed. */
export async function kvDel(key: string): Promise<boolean> {
  const r = await getRedis();
  if (!r) return false;
  try {
    const n = await r.del(key);
    return typeof n === 'number' ? n > 0 : Boolean(n);
  } catch (err) {
    console.error('[kv] del failed:', err);
    return false;
  }
}

/**
 * Increment a counter, setting its TTL on first touch. Returns the new count,
 * or null if KV is unavailable (caller decides whether to allow-through).
 */
export async function kvIncrWithTtl(key: string, ttlSec: number): Promise<number | null> {
  const r = await getRedis();
  if (!r) return null;
  try {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, ttlSec);
    return n;
  } catch (err) {
    console.error('[kv] incr failed:', err);
    return null;
  }
}

/**
 * Consume a single-use nonce. Returns true only if the key existed and we
 * deleted it here (first use). Returns false if it was already used/absent —
 * OR if KV is unavailable, in which case single-use cannot be enforced; the
 * caller must decide its stance (we treat "not enforceable" as allow, since
 * the token itself is still HMAC-signed and time-limited).
 */
export async function kvConsumeNonce(key: string): Promise<{ firstUse: boolean; enforced: boolean }> {
  if (!isKvConfigured()) return { firstUse: true, enforced: false };
  const removed = await kvDel(key);
  return { firstUse: removed, enforced: true };
}
