import { test, expect } from '@playwright/test'
import { loginAdminWithBackoff } from './support/adminLogin'
const vnd = (value: string) =>
  new Intl.NumberFormat('vi-VN').format(BigInt(value.split('.')[0])) + ' ₫'

test.setTimeout(120000)

test('dedicated admin dashboard shows server totals, recent orders and mobile navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await loginAdminWithBackoff(page)
  const metrics = page.locator('.dashboard-metrics')
  await expect(metrics).toHaveAttribute('aria-busy', 'false')
  const products = await (
    await page.request.get('/api/v1/admin/catalog/products?pageSize=1')
  ).json()
  const pending = await (
    await page.request.get('/api/v1/admin/orders/?status=pending&pageSize=1')
  ).json()
  const stock = await (
    await page.request.get('/api/v1/admin/inventory/?lowOnly=true&pageSize=1')
  ).json()
  await expect(
    metrics.getByRole('link').filter({ hasText: 'Tổng sản phẩm' }).locator('strong'),
  ).toHaveText(products.totalCount.toLocaleString('vi-VN'))
  await expect(
    metrics.getByRole('link').filter({ hasText: 'Chờ xác nhận' }).locator('strong'),
  ).toHaveText(pending.totalCount.toLocaleString('vi-VN'))
  await expect(
    metrics.getByRole('link').filter({ hasText: 'Kho cần chú ý' }).locator('strong'),
  ).toHaveText(stock.totalCount.toLocaleString('vi-VN'))
  await expect(page.locator('.site-header')).toHaveCount(0)
  await expect(page.locator('.site-footer')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mở tư vấn chọn gốm' })).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/admin-dashboard-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: 'test-results/admin-dashboard-mobile.png', fullPage: true })
  await metrics.getByRole('link').filter({ hasText: 'Chờ xác nhận' }).click()
  await expect(page).toHaveURL(/admin\/orders\?status=pending/)
  await page.locator('.admin-menu-toggle').click()
  await expect(
    page
      .getByRole('navigation', { name: 'Điều hướng quản trị' })
      .getByRole('link', { name: 'Đơn hàng' }),
  ).toHaveAttribute('aria-current', 'page')
})

test('dashboard period and order filters use live server data and retain the selected period', async ({
  page,
}) => {
  await loginAdminWithBackoff(page)
  const sales = page.locator('.dashboard-sales')
  await expect(page.locator('.dashboard-revenue-metrics')).toHaveAttribute('aria-busy', 'false')
  const url = await sales.getByRole('link', { name: 'Báo cáo chi tiết' }).getAttribute('href')
  const report = await (
    await page.request.get('/api/v1/admin/reports?' + url!.split('?')[1])
  ).json()
  await expect(
    page.locator('.dashboard-revenue-metrics > div').nth(0).locator('strong'),
  ).toHaveText(vnd(report.metrics.completedSalesVnd))
  await expect(
    page.locator('.dashboard-revenue-metrics > div').nth(1).locator('strong'),
  ).toHaveText(report.metrics.completedOrders.toLocaleString('vi-VN'))
  await expect(page.locator('.dashboard-ranking li')).toHaveCount(
    Math.min(2, report.topVariants.length),
  )
  await expect(page.locator('.dashboard-stock-list li')).toHaveCount(
    Math.min(2, report.lowStock.length),
  )
  const response = page.waitForResponse(
    (res) => res.url().includes('/api/v1/admin/reports?') && res.status() === 200,
  )
  await page.getByLabel('Kỳ thống kê dashboard').selectOption('7')
  await expect(page).toHaveURL(/days=7/)
  const week = await (await response).json()
  expect((Date.parse(week.period.to) - Date.parse(week.period.from)) / 86400000).toBe(6)
  await expect(
    page.locator('.dashboard-revenue-metrics > div').nth(0).locator('strong'),
  ).toHaveText(vnd(week.metrics.completedSalesVnd))
  await page.reload()
  await expect(page.getByLabel('Kỳ thống kê dashboard')).toHaveValue('7')
  const filters = page.getByRole('group', { name: 'Lọc đơn hàng trên tổng quan' })
  const ordersResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/admin/orders/?') &&
      res.url().includes('status=pending') &&
      new URL(res.url()).searchParams.get('pageSize') === '4',
  )
  await filters.getByRole('button', { name: 'Chờ xác nhận' }).click()
  const pending = await (await ordersResponse).json()
  await expect(filters.getByRole('button', { name: 'Chờ xác nhận' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('.dashboard-order-table tbody tr')).toHaveCount(pending.items.length)
  for (const row of await page.locator('.dashboard-order-table tbody tr').all()) {
    await expect(row.locator('.dashboard-status')).toHaveText('Chờ xác nhận')
  }
  await page.getByRole('link', { name: 'Xem danh sách đầy đủ' }).click()
  await expect(page).toHaveURL(/admin\/orders\?status=pending/)
  await page.goto('/admin')
  await expect(page.locator('.dashboard-metrics')).toHaveAttribute('aria-busy', 'false')
  await page.locator('.dashboard-metric').filter({ hasText: 'Kho cần chú ý' }).click()
  await expect(page).toHaveURL(/admin\/inventory\?lowOnly=true/)
  await expect(page.getByLabel('Chỉ xem sắp hết hàng')).toBeChecked()
})

test('report outage leaves operational dashboard usable and retry restores revenue', async ({
  page,
}) => {
  await page.route('**/api/v1/admin/reports?**', (route) =>
    route.fulfill({ status: 503, json: { title: 'Unavailable' } }),
  )
  await loginAdminWithBackoff(page)
  await expect(page.locator('.dashboard-sales').getByRole('alert')).toContainText(
    'Chưa tải được doanh thu trong kỳ.',
  )
  await expect(page.locator('.dashboard-metrics')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.dashboard-metric').first().locator('strong')).not.toHaveText('—')
  await expect(page.getByRole('heading', { name: 'Công việc hôm nay' })).toBeVisible()
  await page.unroute('**/api/v1/admin/reports?**')
  await page.getByRole('button', { name: 'Thử lại doanh thu' }).click()
  await expect(page.locator('.dashboard-revenue-metrics')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.dashboard-sales').getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Cảnh báo tồn kho' })).toBeVisible()
})
