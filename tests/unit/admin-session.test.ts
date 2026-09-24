import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createSessionToken,
  getAdminConfig,
  passwordMatches,
  verifySessionToken,
} from '../../lib/admin-session'

const SECRET = 'x'.repeat(40)

describe('getAdminConfig', () => {
  it('is locked (fail closed) when ADMIN_PASSWORD is unset', () => {
    const c = getAdminConfig({ ADMIN_SESSION_SECRET: SECRET })
    assert.equal(c.ok, false)
    if (!c.ok) assert.match(c.reason, /ADMIN_PASSWORD/)
  })

  it('is locked when ADMIN_SESSION_SECRET is missing or too short', () => {
    assert.equal(getAdminConfig({ ADMIN_PASSWORD: 'pw' }).ok, false)
    const c = getAdminConfig({ ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: 'short' })
    assert.equal(c.ok, false)
    if (!c.ok) assert.match(c.reason, /ADMIN_SESSION_SECRET/)
  })

  it('is enabled when both are set', () => {
    const c = getAdminConfig({ ADMIN_PASSWORD: 'pw', ADMIN_SESSION_SECRET: SECRET })
    assert.equal(c.ok, true)
  })
})

describe('passwordMatches', () => {
  it('matches only the exact password', async () => {
    assert.equal(await passwordMatches('hunter2', 'hunter2'), true)
    assert.equal(await passwordMatches('hunter3', 'hunter2'), false)
    assert.equal(await passwordMatches('hunter2 ', 'hunter2'), false)
    assert.equal(await passwordMatches('', 'hunter2'), false)
  })
})

describe('session tokens', () => {
  const config = { ok: true as const, password: 'pw', secret: SECRET }

  it('accepts a freshly issued token', async () => {
    const token = await createSessionToken(config, { now: 1_000, ttlMs: 60_000 })
    assert.equal(await verifySessionToken(token, config, 2_000), true)
  })

  it('rejects an expired token', async () => {
    const token = await createSessionToken(config, { now: 1_000, ttlMs: 60_000 })
    assert.equal(await verifySessionToken(token, config, 61_001), false)
  })

  it('rejects a tampered expiry or signature', async () => {
    const token = await createSessionToken(config, { now: 1_000, ttlMs: 60_000 })
    const [exp, sig] = token.split('.')
    assert.equal(await verifySessionToken(`${Number(exp) + 999_999}.${sig}`, config, 2_000), false)
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    assert.equal(await verifySessionToken(`${exp}.${flipped}`, config, 2_000), false)
  })

  it('rejects tokens signed with another secret or before a password change', async () => {
    const token = await createSessionToken(config, { now: 1_000, ttlMs: 60_000 })
    assert.equal(
      await verifySessionToken(token, { ...config, secret: 'y'.repeat(40) }, 2_000),
      false
    )
    assert.equal(await verifySessionToken(token, { ...config, password: 'new' }, 2_000), false)
  })

  it('rejects garbage and missing tokens', async () => {
    for (const t of [undefined, '', 'abc', '123.', '.abc', 'a.b.c']) {
      assert.equal(await verifySessionToken(t, config, 2_000), false, String(t))
    }
  })

  it('rejects everything when admin is locked', async () => {
    const token = await createSessionToken(config, { now: 1_000, ttlMs: 60_000 })
    assert.equal(await verifySessionToken(token, { ok: false, reason: 'locked' }, 2_000), false)
  })
})
