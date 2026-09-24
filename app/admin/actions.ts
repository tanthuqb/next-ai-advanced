'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { endAdminSession, startAdminSession } from '@/lib/admin-auth'
import { getAdminConfig, passwordMatches } from '@/lib/admin-session'
import { createRateLimiter, getClientIp, readPositiveInt } from '@/lib/rate-limit'

export type LoginState = { error?: string }

// Slows down password guessing (per client IP, per server instance).
const loginLimiter = createRateLimiter({
  limit: readPositiveInt(process.env.ADMIN_LOGIN_RATE_LIMIT_PER_MIN, 10),
  windowMs: 60_000,
})

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const config = getAdminConfig()
  if ('reason' in config) return { error: config.reason }

  const rate = await loginLimiter.check(getClientIp(await headers()))
  if (!rate.allowed) {
    const seconds = Math.ceil(rate.retryAfterMs / 1000)
    return { error: `Too many sign-in attempts. Try again in ${seconds} seconds.` }
  }

  const password = formData.get('password')
  if (typeof password !== 'string' || !(await passwordMatches(password, config.password))) {
    return { error: 'Incorrect password.' }
  }

  await startAdminSession(config)
  redirect('/admin')
}

export async function logout() {
  await endAdminSession()
  redirect('/admin/login')
}
