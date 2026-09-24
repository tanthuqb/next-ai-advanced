import { defineConfig, devices } from '@playwright/test'
import {
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_SESSION_SECRET,
  E2E_CHAT_RATE_LIMIT_PER_MIN,
} from './e2e/test-env'

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
    // A reused server must have been started with the env below, or auth/rate-limit tests fail.
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    // Test-only values; they take precedence over .env.local (Next never overrides
    // variables that are already set in the process environment).
    env: {
      ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET: E2E_ADMIN_SESSION_SECRET,
      CHAT_RATE_LIMIT_PER_MIN: String(E2E_CHAT_RATE_LIMIT_PER_MIN),
      // Every test signs in, so don't let the login brute-force limiter get in the way.
      ADMIN_LOGIN_RATE_LIMIT_PER_MIN: '1000',
    },
  },
})
