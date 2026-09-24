import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('admin authentication', () => {
  test('signed-out visitors are redirected from /admin to the login page', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login(\?|$)/)
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Knowledge content' })).toHaveCount(0)
  })

  test('a wrong password is rejected', async ({ page }) => {
    await loginAsAdmin(page, 'definitely-not-the-password')
    await expect(page.getByTestId('login-error')).toHaveText('Incorrect password.')
    await expect(page).toHaveURL(/\/admin\/login/)
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'suzu_admin_session')).toBeUndefined()
  })

  test('the correct password grants access with a hardened session cookie', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Feed knowledge to the AI' })).toBeVisible()

    const session = (await page.context().cookies()).find((c) => c.name === 'suzu_admin_session')
    expect(session).toBeDefined()
    expect(session?.httpOnly).toBe(true)
    expect(session?.sameSite).toBe('Lax')
    expect(session?.expires).toBeGreaterThan(Date.now() / 1000)
  })

  test('a forged session cookie is not accepted', async ({ page, baseURL }) => {
    await page.context().addCookies([
      { name: 'suzu_admin_session', value: `${Date.now() + 3_600_000}.forged`, url: baseURL! },
    ])
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('logout ends the session', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin$/)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
    const res = await page.request.post('/api/ingest', { data: { content: 'x' } })
    expect(res.status()).toBe(401)
  })
})

test.describe('POST /api/ingest authorization', () => {
  test('returns 401 without a session', async ({ request }) => {
    const res = await request.post('/api/ingest', { data: { content: 'should never be stored' } })
    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  test('returns 401 with a forged session cookie', async ({ request }) => {
    const res = await request.post('/api/ingest', {
      data: { content: 'should never be stored' },
      headers: { cookie: `suzu_admin_session=${Date.now() + 3_600_000}.AAAA` },
    })
    expect(res.status()).toBe(401)
  })
})
