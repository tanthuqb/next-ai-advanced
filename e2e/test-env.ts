// Values injected into the Playwright web server (see playwright.config.ts).
// They are test-only and never read from .env.local.
export const E2E_ADMIN_PASSWORD = 'e2e-admin-password-not-a-real-secret'
export const E2E_ADMIN_SESSION_SECRET = 'e2e-session-secret-0123456789abcdef0123456789'
export const E2E_CHAT_RATE_LIMIT_PER_MIN = 5
