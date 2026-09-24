import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3102)
const baseURL = `http://localhost:${PORT}`

// By default the suite builds the app and serves the production bundle on PORT.
// Set E2E_DEV_SERVER=1 to use `next dev` instead (faster to start, slower per page).
const webServerCommand =
  process.env.E2E_DEV_SERVER === '1'
    ? `npx next dev --port ${PORT}`
    : `npm run build && npx next start --port ${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Live tests call Gemini + Supabase; keep concurrency modest to avoid rate limits.
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
