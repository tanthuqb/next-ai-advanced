// Sliding-window rate limiter used to protect the Gemini free-tier quota.
//
// The default store is in-memory: on a single Node server (`next start`) it is
// global, but on serverless platforms (Vercel) every warm instance has its own
// memory, so the limit is enforced per instance. To share state across
// instances, implement `RateLimitStore` on top of Upstash Redis, Supabase, etc.
// and pass it to `createRateLimiter({ store })`.

export type RateLimitResult = {
  allowed: boolean
  /** Hits left in the current window after this one. */
  remaining: number
  /** When blocked: milliseconds until the next hit would be allowed. */
  retryAfterMs: number
}

export interface RateLimitStore {
  /** Record a hit for `key` (only if allowed) and report whether it is within `limit`. */
  hit(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult>
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>()
  private readonly maxKeys: number

  constructor({ maxKeys = 10_000 }: { maxKeys?: number } = {}) {
    this.maxKeys = maxKeys
  }

  get size() {
    return this.hits.size
  }

  async hit(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
    const windowStart = now - windowMs
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart)

    if (timestamps.length >= limit) {
      this.hits.set(key, timestamps)
      return { allowed: false, remaining: 0, retryAfterMs: timestamps[0] + windowMs - now }
    }

    timestamps.push(now)
    // Re-insert so Map iteration order approximates least-recently-used.
    this.hits.delete(key)
    this.hits.set(key, timestamps)
    this.evict(windowStart)

    return { allowed: true, remaining: limit - timestamps.length, retryAfterMs: 0 }
  }

  private evict(windowStart: number) {
    if (this.hits.size <= this.maxKeys) return
    // Drop keys whose hits have all expired, then the oldest keys if still too many.
    for (const [key, timestamps] of this.hits) {
      if (timestamps[timestamps.length - 1] <= windowStart) this.hits.delete(key)
    }
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break
      this.hits.delete(key)
    }
  }
}

export function createRateLimiter({
  limit,
  windowMs,
  store = new MemoryRateLimitStore(),
  now = Date.now,
}: {
  limit: number
  windowMs: number
  store?: RateLimitStore
  now?: () => number
}) {
  return {
    limit,
    windowMs,
    check: (key: string) => store.hit(key, limit, windowMs, now()),
  }
}

/**
 * Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform;
 * behind other proxies make sure they overwrite (not append to) this header,
 * otherwise clients can spoof it.
 */
export function getClientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Parse a positive integer env var, falling back to `fallback`. */
export function readPositiveInt(value: string | undefined, fallback: number) {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
