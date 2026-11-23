import { expect, type Page } from '@playwright/test'

// A sequential suite can exhaust the real login quota. Respect Retry-After once;
// never change the production limiter or simulate an authenticated cookie.
export async function loginAdminWithBackoff(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!)
  for (let attempt = 0; attempt < 2; attempt++) {
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/auth/login' &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    const response = await responsePromise
    if (response.status() !== 429 || attempt === 1) break
    const seconds = Number(response.headers()['retry-after'] || 60)
    await page.waitForTimeout(
      (Number.isFinite(seconds) ? Math.min(60, Math.max(1, seconds)) : 60) * 1000 + 250,
    )
  }
  await expect(page).toHaveURL('/admin')
}
