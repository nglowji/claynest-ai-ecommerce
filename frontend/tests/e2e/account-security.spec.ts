import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { loginAdminWithBackoff as loginAdmin } from './support/adminLogin'

function mailLink(email: string, path: string) {
  for (const name of readdirSync('../.local/test-mail')) {
    if (!name.endsWith('.eml')) continue
    const message = readFileSync('../.local/test-mail/' + name, 'utf8')
    if (!message.includes(email)) continue
    const body = Buffer.from(
      message
        .split(/\r?\n\r?\n/)
        .slice(1)
        .join(''),
      'base64',
    ).toString('utf8')
    const link = body
      .split('\n')
      .find((line) => line.startsWith('http://127.0.0.1:4173/' + path + '#'))
    if (link) return link.trim()
  }
  return ''
}

test('customer edits own profile, confirms email and recovers password through private mail', async ({
  page,
}) => {
  const email = `security-${Date.now()}@example.test`
  const password = 'Security-Password!123'
  const changed = 'Changed-Password!456'
  const recovered = 'Recovered-Password!789'
  await page.goto('/register')
  await page.getByLabel('Tên của bạn').fill('Khách bảo mật')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/account')
  await page.getByLabel('Họ và tên', { exact: true }).fill('Khách đã cập nhật')
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
  await expect(page.locator('main').getByRole('status')).toHaveText('Đã cập nhật họ tên.')
  await page.reload()
  await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue('Khách đã cập nhật')
  await page.getByRole('button', { name: 'Gửi email xác minh', exact: true }).click()
  await expect.poll(() => mailLink(email, 'verify-email')).not.toBe('')
  await page.goto(mailLink(email, 'verify-email'))
  await expect.poll(() => new URL(page.url()).hash).toBe('')
  await page.getByRole('button', { name: 'Xác nhận email', exact: true }).click()
  await expect(page.locator('main').getByRole('status')).toContainText('Email đã được xác minh')
  await page.goto('/account')
  await expect(page.getByText('Đã xác minh email.', { exact: true })).toBeVisible()
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(password)
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(changed)
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(changed)
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.locator('main').getByRole('status')).toContainText('Đã đổi mật khẩu')
  await page.getByRole('link', { name: 'Quên mật khẩu?', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi hướng dẫn', exact: true }).click()
  await expect(page.locator('main').getByRole('status')).toContainText(
    'Nếu email thuộc một tài khoản',
  )
  await expect.poll(() => mailLink(email, 'reset-password')).not.toBe('')
  await page.goto(mailLink(email, 'reset-password'))
  await expect.poll(() => new URL(page.url()).hash).toBe('')
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(recovered)
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(recovered)
  await page.getByRole('button', { name: 'Lưu mật khẩu mới', exact: true }).click()
  await expect(page.locator('main').getByRole('status')).toContainText('Đã đặt lại mật khẩu')
  await page.getByRole('link', { name: 'Đến trang đăng nhập', exact: false }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(recovered)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/account')
  await page.screenshot({ path: 'test-results/account-security-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('iframe').count()).toBe(0)
  await page.screenshot({ path: 'test-results/account-security-mobile.png', fullPage: true })
  await page.goto('/reset-password')
  await expect(page.getByRole('alert')).toContainText('Liên kết thiếu thông tin')
})

test('administrator has account settings inside admin layout', async ({ page }) => {
  await loginAdmin(page)
  await page.getByRole('link', { name: 'Hồ sơ & bảo mật', exact: true }).click()
  await expect(page).toHaveURL('/admin/account')
  await expect(page.getByRole('heading', { name: 'Hồ sơ & bảo mật', exact: true })).toBeVisible()
  await expect(page.getByLabel('Mật khẩu hiện tại', { exact: true })).toBeVisible()
  expect(await page.locator('iframe').count()).toBe(0)
})
