import { expect, test } from '@playwright/test'

// LIVE: hits the real /api/chat -> Supabase Edge Function + pgvector RPC -> Gemini.
// Requires real keys in .env.local. Set E2E_SKIP_LIVE=1 to skip.
test.describe('live chat', () => {
  test.skip(process.env.E2E_SKIP_LIVE === '1', 'E2E_SKIP_LIVE=1')

  test('sends a prompt and receives a streamed assistant reply', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto('/chat')

    const responsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/chat') && res.request().method() === 'POST'
    )

    await page.getByRole('textbox', { name: 'Message' }).fill('Hi Suzu! In one sentence, who are you?')
    await page.getByRole('button', { name: 'Send message' }).click()

    const response = await responsePromise
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/event-stream')

    await expect(page.locator('[data-testid="chat-message"][data-role="user"]')).toHaveCount(1)

    const assistant = page.locator('[data-testid="chat-message"][data-role="assistant"]').first()
    await expect(assistant).toBeVisible({ timeout: 150_000 })
    // Wait until streaming has produced a meaningful amount of text.
    await expect
      .poll(async () => (await assistant.innerText()).trim().length, { timeout: 150_000 })
      .toBeGreaterThan(10)

    // Once streaming is done the input is re-enabled and no error is shown.
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeEnabled({ timeout: 150_000 })
    await expect(page.getByTestId('chat-error')).toHaveCount(0)
  })
})
