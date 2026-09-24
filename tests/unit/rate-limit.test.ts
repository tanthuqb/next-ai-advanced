import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRateLimiter, getClientIp, MemoryRateLimitStore } from '../../lib/rate-limit'

describe('createRateLimiter (in-memory sliding window)', () => {
  it('allows up to `limit` hits in the window, then blocks with a retry-after', async () => {
    let now = 1_000_000
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now })

    for (let i = 0; i < 3; i++) {
      const r = await limiter.check('1.2.3.4')
      assert.equal(r.allowed, true, `hit ${i + 1} should be allowed`)
      assert.equal(r.remaining, 2 - i)
      now += 1_000
    }

    const blocked = await limiter.check('1.2.3.4')
    assert.equal(blocked.allowed, false)
    assert.equal(blocked.remaining, 0)
    // Oldest hit was at 1_000_000 -> frees up at 1_060_000; now = 1_003_000.
    assert.equal(blocked.retryAfterMs, 57_000)
  })

  it('slides: a hit becomes available again once the oldest hit leaves the window', async () => {
    let now = 0
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => now })
    await limiter.check('k') // t=0
    now = 5_000
    await limiter.check('k') // t=5000
    now = 9_999
    assert.equal((await limiter.check('k')).allowed, false)
    now = 10_000 // hit at t=0 has expired, t=5000 still counts
    assert.equal((await limiter.check('k')).allowed, true)
    assert.equal((await limiter.check('k')).allowed, false)
  })

  it('tracks keys independently', async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    assert.equal((await limiter.check('a')).allowed, true)
    assert.equal((await limiter.check('a')).allowed, false)
    assert.equal((await limiter.check('b')).allowed, true)
  })

  it('blocked attempts do not extend the ban', async () => {
    let now = 0
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => now })
    await limiter.check('k')
    now = 500
    assert.equal((await limiter.check('k')).allowed, false)
    now = 1_000
    assert.equal((await limiter.check('k')).allowed, true)
  })

  it('accepts a pluggable store', async () => {
    const calls: string[] = []
    const store = {
      async hit(key: string) {
        calls.push(key)
        return { allowed: false, remaining: 0, retryAfterMs: 42 }
      },
    }
    const limiter = createRateLimiter({ limit: 5, windowMs: 1_000, store })
    const r = await limiter.check('x')
    assert.deepEqual(calls, ['x'])
    assert.equal(r.allowed, false)
    assert.equal(r.retryAfterMs, 42)
  })

  it('memory store evicts stale keys so memory stays bounded', async () => {
    let now = 0
    const store = new MemoryRateLimitStore({ maxKeys: 2 })
    await store.hit('a', 1, 1_000, now)
    await store.hit('b', 1, 1_000, now)
    now = 2_000
    await store.hit('c', 1, 1_000, now)
    assert.ok(store.size <= 2, `expected <= 2 keys, got ${store.size}`)
  })
})

describe('getClientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    assert.equal(getClientIp(h), '203.0.113.7')
  })

  it('falls back to x-real-ip, then "unknown"', () => {
    assert.equal(getClientIp(new Headers({ 'x-real-ip': '198.51.100.2' })), '198.51.100.2')
    assert.equal(getClientIp(new Headers()), 'unknown')
  })
})
