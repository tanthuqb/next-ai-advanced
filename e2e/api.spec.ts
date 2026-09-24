import { expect, test } from '@playwright/test'
import { chatRequestBody, loginAsAdmin, parseUIMessageStream } from './helpers'

test.describe('POST /api/chat', () => {
  test('rejects a request without messages', async ({ request }) => {
    const res = await request.post('/api/chat', { data: {} })
    expect(res.status()).toBe(400)
  })

  test('LIVE: streams a UI message response with text and source metadata', async ({ request }) => {
    test.skip(process.env.E2E_SKIP_LIVE === '1', 'E2E_SKIP_LIVE=1')
    test.setTimeout(180_000)

    const res = await request.post('/api/chat', {
      data: chatRequestBody('Give me one short tip for a job interview.'),
      timeout: 170_000,
    })
    const raw = await res.text()
    expect(res.status(), raw).toBe(200)
    expect(res.headers()['content-type']).toContain('text/event-stream')
    expect(res.headers()['x-vercel-ai-ui-message-stream']).toBe('v1')

    const chunks = parseUIMessageStream(raw)
    const types = chunks.map((c) => c.type)
    expect(types).toContain('start')
    expect(types).toContain('finish')
    expect(types, raw).not.toContain('error')

    const start = chunks.find((c) => c.type === 'start') as {
      messageMetadata?: { sources?: unknown[] }
    }
    expect(Array.isArray(start.messageMetadata?.sources)).toBe(true)

    const text = chunks
      .filter((c) => c.type === 'text-delta')
      .map((c) => c.delta as string)
      .join('')
    expect(text.trim().length).toBeGreaterThan(10)
  })
})

test.describe('POST /api/ingest (signed in)', () => {
  // page.request shares the browser context's cookies, so it carries the admin session.
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('rejects empty content without touching the database', async ({ page }) => {
    const res = await page.request.post('/api/ingest', { data: { content: '   ' } })
    expect(res.status()).toBe(400)
    expect(await res.json()).toEqual({ error: 'content must be a non-empty string' })
  })

  // LIVE + WRITES TO THE REMOTE DATABASE (inserts a nods_page_section row).
  test('LIVE: ingests a chunk through the Edge Function', async ({ page }) => {
    test.skip(
      process.env.E2E_ALLOW_INGEST !== '1',
      'writes to the remote DB; set E2E_ALLOW_INGEST=1 to run'
    )
    test.setTimeout(90_000)

    const res = await page.request.post('/api/ingest', {
      data: { content: `E2E ingest check ${new Date().toISOString()}: Suzu test knowledge chunk.` },
      timeout: 80_000,
    })
    const body = await res.json()
    expect(res.status(), JSON.stringify(body)).toBe(200)
    expect(body).toMatchObject({ success: true, ingested: 1 })
  })
})
