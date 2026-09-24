import { expect, test } from '@playwright/test'
import { chatRequestBody } from './helpers'
import { E2E_CHAT_RATE_LIMIT_PER_MIN } from './test-env'

// Each test uses its own fake client IP so it never shares a bucket with other tests.
const octet = () => Math.floor(Math.random() * 254) + 1
const fakeIp = () => `10.${octet()}.${octet()}.${octet()}`

test.describe('/api/chat rate limit', () => {
  test('returns 429 with a friendly message after exceeding the per-IP limit', async ({ request }) => {
    const headers = { 'x-forwarded-for': fakeIp() }
    // Invalid bodies (400) still count, so this never calls Gemini.
    for (let i = 0; i < E2E_CHAT_RATE_LIMIT_PER_MIN; i++) {
      const res = await request.post('/api/chat', { data: {}, headers })
      expect(res.status(), `request ${i + 1}`).toBe(400)
    }

    const limited = await request.post('/api/chat', { data: {}, headers })
    expect(limited.status()).toBe(429)
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)
    expect(await limited.text()).toMatch(/too many messages/i)

    // Another client is unaffected.
    const other = await request.post('/api/chat', { data: {}, headers: { 'x-forwarded-for': fakeIp() } })
    expect(other.status()).toBe(400)
  })

  test('rejects an over-long message with 413 before calling the model', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: chatRequestBody('a'.repeat(20_000)),
      headers: { 'x-forwarded-for': fakeIp() },
    })
    expect(res.status()).toBe(413)
    expect(await res.text()).toMatch(/too long/i)
  })

  test('the chat UI shows the 429 message', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'retry-after': '30' },
        body: 'You are sending too many messages. Please wait 30 seconds and try again.',
      })
    )
    await page.goto('/chat')
    await page.getByRole('textbox', { name: 'Message' }).fill('Hi')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByTestId('chat-error')).toContainText(
      'You are sending too many messages. Please wait 30 seconds and try again.'
    )
  })
})
