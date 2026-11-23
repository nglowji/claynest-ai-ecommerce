import { test, expect } from '@playwright/test'

for (const path of ['/account', '/admin']) {
  test(`temporary auth outage preserves ${path} and can retry`, async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ status: 503, json: { title: 'Unavailable' } }),
    )
    await page.goto(path)
    await expect(page.getByRole('alert')).toContainText('Chưa kiểm tra được phiên đăng nhập.')
    await expect(page).toHaveURL(path)
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401, body: '' }))
    await page.getByRole('button', { name: 'Kiểm tra lại phiên' }).click()
    await expect(page).toHaveURL('/login')
    await expect(page.locator('#login-title')).toBeVisible()
  })
}
