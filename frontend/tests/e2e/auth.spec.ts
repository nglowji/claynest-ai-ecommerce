import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
if (!adminEmail || !adminPassword) throw new Error('Use the isolated Compose e2e profile with generated E2E credentials.')
async function loginAdmin(page: Page, remember = false) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(adminEmail!)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(adminPassword!)
  if (remember) await page.getByLabel('Giữ đăng nhập', { exact: true }).check()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/admin')
  await expect(page.getByText('Phiên quản trị đã được xác thực bởi máy chủ.')).toBeVisible()
}

test('guest cannot open administration', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL('/login')
  const response = await page.request.get('/api/v1/admin/session')
  expect(response.status()).toBe(401)
  expect((await response.json()).code).toBe('unauthenticated')
})

test('registration validates confirmation, creates a customer and denies admin API', async ({ page }) => {
  await page.goto('/register')
  const email = `browser-${randomUUID()}@example.test`
  const password = `Browser-${randomUUID()}-Aa1!`
  await page.getByLabel('Tên của bạn').fill('Người thương gốm')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Nhập lại mật khẩu').fill('Different-password-Aa1!')
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Mật khẩu xác nhận chưa khớp.')
  await page.getByLabel('Nhập lại mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('status')).toContainText('Tài khoản đã sẵn sàng')
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/account')
  expect((await page.request.get('/api/v1/admin/session')).status()).toBe(403)
  await page.goto('/admin')
  await expect(page).toHaveURL('/account')
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL('/login')
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401)
})

test('wrong credentials show a safe error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(`unknown-${randomUUID()}@example.test`)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Incorrect-password-Aa1!')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Email hoặc mật khẩu không đúng')
  await expect(page).toHaveURL('/login')
})

test('admin redirects into dedicated layout, restores session and logs out', async ({ page }) => {
  await loginAdmin(page)
  await expect(page.getByRole('navigation', { name: 'Điều hướng quản trị' })).toBeVisible()
  await expect(page.locator('.site-footer')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Phiên quản trị đã được xác thực bởi máy chủ.')).toBeVisible()
  const response = await page.request.get('/api/v1/admin/session')
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toContain('no-store')
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL('/login')
  expect((await page.request.get('/api/v1/admin/session')).status()).toBe(401)
})

test('remember me persists cookie and a revoked session leaves admin immediately', async ({ page, context }) => {
  await loginAdmin(page, true)
  const cookie = (await context.cookies('http://127.0.0.1:4173/api/v1/auth/me')).find(value => value.name === 'nang_gom.admin')
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000)
  await context.clearCookies()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page).toHaveURL('/login')
  expect((await page.request.get('/api/v1/admin/session')).status()).toBe(401)
})

test('network interruption offers retry without disclosing admin content', async ({ page }) => {
  await page.route('**/api/v1/admin/session', route => route.abort())
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(adminEmail!)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(adminPassword!)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Chưa kết nối')
  await expect(page.locator('.admin-welcome')).toHaveCount(0)
  await page.unroute('**/api/v1/admin/session')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Phiên quản trị đã được xác thực bởi máy chủ.')).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
})

test('mobile entry remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/register')
  await expect(page.getByLabel('Tên của bạn')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo tài khoản', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/register-mobile.png', fullPage: true })
})
