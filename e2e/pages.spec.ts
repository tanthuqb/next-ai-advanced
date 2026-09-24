import { expect, test } from '@playwright/test'
import { fulfillWithUIMessageStream, loginAsAdmin } from './helpers'

test.describe('landing page', () => {
  test('renders the title and navigation links', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Suzu AI/)
    await expect(page.getByRole('heading', { level: 1, name: 'Suzu AI' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chat with Suzu' })).toHaveAttribute('href', '/chat')
    await expect(page.getByRole('link', { name: 'Feed knowledge' })).toHaveAttribute('href', '/admin')
  })

  test('navigates to the chat page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Chat with Suzu' }).click()
    await expect(page).toHaveURL(/\/chat$/)
    await expect(page.getByPlaceholder('Send Suzu a message...')).toBeVisible()
  })
})

test.describe('chat page UI (mocked API)', () => {
  test('renders header, model badge, suggestions and input', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByText('Suzu AI', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Gemini \d+(\.\d+)? Flash$/)).toBeVisible()
    await expect(page.getByText('Suzu is ready.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'How should I prepare my portfolio?' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeEditable()
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  test('a typed message is sent and the streamed reply is rendered', async ({ page }) => {
    let requestBody: { messages?: { role: string; parts: { type: string; text?: string }[] }[] } = {}
    await page.route('**/api/chat', async (route) => {
      requestBody = route.request().postDataJSON()
      await fulfillWithUIMessageStream(route, 'Hello from the mocked Suzu stream.')
    })

    await page.goto('/chat')
    const input = page.getByRole('textbox', { name: 'Message' })
    await input.fill('I want to become a product designer')
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled()
    await page.getByRole('button', { name: 'Send message' }).click()

    const userMessage = page.locator('[data-testid="chat-message"][data-role="user"]')
    await expect(userMessage).toHaveText('I want to become a product designer')
    await expect(input).toHaveValue('')

    const assistantMessage = page.locator('[data-testid="chat-message"][data-role="assistant"]')
    await expect(assistantMessage).toContainText('Hello from the mocked Suzu stream.')

    const lastMessage = requestBody.messages?.at(-1)
    expect(lastMessage?.role).toBe('user')
    expect(lastMessage?.parts[0]?.text).toBe('I want to become a product designer')
  })

  test('shows an error message when the API fails', async ({ page }) => {
    await page.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'boom' }))
    await page.goto('/chat')
    await page.getByRole('textbox', { name: 'Message' }).fill('Hi')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByTestId('chat-error')).toContainText('Suzu could not answer right now')
  })
})

test.describe('admin page (signed in)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('renders the ingest form', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Feed knowledge to the AI' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Knowledge content' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Teach AI now' })).toBeDisabled()
  })

  test('submits content to /api/ingest and shows the result (mocked API)', async ({ page }) => {
    let posted: { content?: string } = {}
    await page.route('**/api/ingest', async (route) => {
      posted = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          ingested: 2,
          message: 'Suzu has finished ingesting 2 knowledge chunk(s).',
        }),
      })
    })

    await page.goto('/admin')
    await page.getByRole('textbox', { name: 'Knowledge content' }).fill('Line one\nLine two')
    await page.getByRole('button', { name: 'Teach AI now' }).click()
    await expect(page.getByRole('status')).toHaveText('Suzu has finished ingesting 2 knowledge chunk(s).')
    expect(posted.content).toBe('Line one\nLine two')
  })
})
