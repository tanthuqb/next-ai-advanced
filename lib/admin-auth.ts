// Server-only admin session helpers built on next/headers.
// Use these in server components, route handlers and server actions
// (defense in depth: proxy.ts is only an optimistic first check).
import { cookies } from 'next/headers'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createSessionToken,
  isAdminSession,
} from './admin-session'

export async function hasAdminSession() {
  const store = await cookies()
  return isAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)
}

export async function startAdminSession(config: { password: string; secret: string }) {
  const token = await createSessionToken(config)
  const store = await cookies()
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  })
}

export async function endAdminSession() {
  const store = await cookies()
  store.delete(ADMIN_SESSION_COOKIE)
}
