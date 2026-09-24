// Admin session helpers: password check + HMAC-signed session cookie.
// Uses only Web Crypto so it runs in proxy.ts, route handlers and server actions.
//
// Token format: `<expiresAtMs>.<base64url(HMAC-SHA256(key, "suzu-admin:" + expiresAtMs))>`
// where key is derived from ADMIN_SESSION_SECRET *and* ADMIN_PASSWORD, so changing
// either one invalidates every existing session.

export const ADMIN_SESSION_COOKIE = 'suzu_admin_session'
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours
const MIN_SECRET_LENGTH = 32

export type AdminConfig =
  | { ok: true; password: string; secret: string }
  | { ok: false; reason: string }

type Env = Record<string, string | undefined>

/** Admin is locked (fail closed) unless ADMIN_PASSWORD and a strong ADMIN_SESSION_SECRET are set. */
export function getAdminConfig(env: Env = process.env): AdminConfig {
  const password = env.ADMIN_PASSWORD
  const secret = env.ADMIN_SESSION_SECRET
  if (!password) {
    return { ok: false, reason: 'Admin is locked: ADMIN_PASSWORD is not set on the server.' }
  }
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      reason: `Admin is locked: ADMIN_SESSION_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters.`,
    }
  }
  return { ok: true, password, secret }
}

const encoder = new TextEncoder()

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Constant-time password comparison (hashing first hides the length of both values). */
export async function passwordMatches(input: string, expected: string) {
  const [a, b] = await Promise.all([sha256(input), sha256(expected)])
  return constantTimeEqual(a, b)
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function signingKey(config: { password: string; secret: string }) {
  const material = await sha256(`${config.secret}\u0000${config.password}`)
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

const payloadFor = (expiresAt: number) => encoder.encode(`suzu-admin:${expiresAt}`)

export async function createSessionToken(
  config: { password: string; secret: string },
  { now = Date.now(), ttlMs = ADMIN_SESSION_TTL_MS }: { now?: number; ttlMs?: number } = {}
) {
  const expiresAt = now + ttlMs
  const key = await signingKey(config)
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, payloadFor(expiresAt)))
  return `${expiresAt}.${toBase64Url(signature)}`
}

export async function verifySessionToken(
  token: string | undefined,
  config: AdminConfig,
  now: number = Date.now()
) {
  if (!config.ok || !token) return false
  const parts = token.split('.')
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false

  const expiresAt = Number(parts[0])
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false

  const signature = fromBase64Url(parts[1])
  if (!signature) return false

  const key = await signingKey(config)
  // crypto.subtle.verify compares the MAC in constant time.
  return crypto.subtle.verify('HMAC', key, signature, payloadFor(expiresAt))
}

/** Convenience for request handlers: is this cookie value a valid admin session? */
export async function isAdminSession(token: string | undefined) {
  return verifySessionToken(token, getAdminConfig())
}
