import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { loginAdminWithBackoff } from './support/adminLogin'

const vnd = (value: string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
    .format(BigInt(value))
    .replace(/\s/g, ' ')

test('sales report reconciles server totals, exports aggregate CSV and handles filters, empty, retry and mobile', async ({
  page,
}) => {
  test.setTimeout(120000)
  await loginAdminWithBackoff(page)
  await page
    .getByRole('navigation', { name: 'Điều hướng quản trị' })
    .getByRole('link', { name: 'Báo cáo & phân tích' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Báo cáo & phân tích', exact: true }),
  ).toBeVisible()
  const sales = page.getByTestId('completed-sales')
  await expect(sales).toBeVisible()
  const response = await page.request.get('/api/v1/admin/reports')
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toContain('no-store')
  const report = await response.json()
  expect(report.isDemo).toBe(true)
  expect(report.metrics.completedOrders).toBeGreaterThanOrEqual(8)
  expect(
    report.trend
      .reduce((sum: bigint, p: { salesVnd: string }) => sum + BigInt(p.salesVnd), 0n)
      .toString(),
  ).toBe(report.metrics.completedSalesVnd)
  await expect(sales).toHaveText(vnd(report.metrics.completedSalesVnd))
  await expect(page.getByTestId('completed-count')).toHaveText(
    report.metrics.completedOrders.toLocaleString('vi-VN'),
  )
  await expect(page.getByRole('note')).toContainText('DEMO DATA')
  await expect(page.locator('.report-chart svg')).toBeVisible()
  await expect(page.locator('.site-footer')).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất CSV' }).click()
  const download = await downloadPromise
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv).toContain(report.metrics.completedSalesVnd)
  expect(csv).toContain('DEMO DATA')
  expect(csv).not.toContain('demo@example.invalid')
  expect(csv).not.toContain('0900000000')
  expect(csv).not.toContain('PRIVATE-REPORT-SENTINEL')
  expect(download.suggestedFilename()).toMatch(/^nang-gom-report-/)
  await expect(page.locator('.report-comparison-period')).toContainText('So sánh kỳ trước:')
  await page.getByRole('tab', { name: 'Xu hướng', exact: true }).click()
  await expect(page.locator('#reports-view-panel tbody tr')).toHaveCount(10)
  await page.getByRole('button', { name: 'Trang 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Trang 2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByLabel('Sắp xếp kỳ báo cáo').selectOption('desc')
  await expect(page.getByRole('button', { name: 'Trang 1', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByRole('tab', { name: 'Sản phẩm', exact: true }).click()
  await expect(page.locator('#reports-view-panel tbody tr')).toHaveCount(
    Math.min(5, report.topVariants.length),
  )
  await page.getByRole('tab', { name: 'Cảnh báo kho', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Xem kho' })).toHaveAttribute(
    'href',
    '/admin/inventory?lowOnly=true',
  )
  await expect(page.locator('#reports-view-panel tbody tr')).toHaveCount(
    Math.min(5, report.lowStock.length),
  )
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Cảnh báo kho', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('tab', { name: 'Doanh thu', exact: true }).click()
  await page.screenshot({ path: 'test-results/admin-reports-desktop.png', fullPage: true })
  await page.getByLabel('Nhóm báo cáo theo').selectOption('week')
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  await expect(page).toHaveURL(/grain=week/)
  await expect(page.getByRole('heading', { name: 'Doanh thu theo tuần' })).toBeVisible()
  await expect(sales).toHaveText(vnd(report.metrics.completedSalesVnd))
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: 'test-results/admin-reports-mobile.png', fullPage: true })
  await page.getByLabel('Báo cáo từ ngày').fill('2049-01-01')
  await page.getByLabel('Báo cáo đến ngày').fill('2049-01-03')
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chưa có đơn hoàn tất trong kỳ' })).toBeVisible()
  await expect(page.getByTestId('average-order-value')).toHaveText('—')
  await expect(sales).toHaveText(vnd('0'))
  await page.route('**/api/v1/admin/reports**', (route) => route.abort())
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.unroute('**/api/v1/admin/reports**')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Chưa có đơn hoàn tất trong kỳ' })).toBeVisible()
})

test('prior-period outage keeps current report usable and refresh retries comparison', async ({
  page,
}) => {
  test.setTimeout(120000)
  await loginAdminWithBackoff(page)
  await page.route('**/api/v1/admin/reports**', (route) =>
    new URL(route.request().url()).searchParams.has('from') ? route.abort() : route.continue(),
  )
  await page.goto('/admin/reports')
  await expect(page.getByTestId('completed-sales')).toBeVisible()
  await expect(page.locator('.report-comparison-period')).toContainText('Chưa tải được kỳ trước')
  await expect(page.locator('.report-chart svg')).toBeVisible()
  await page.unroute('**/api/v1/admin/reports**')
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.report-comparison-period')).toContainText('So sánh kỳ trước:')
  await page.route('**/api/v1/admin/reports/export.csv?**', (route) =>
    route.fulfill({ status: 503 }),
  )
  await page.getByRole('button', { name: 'Xuất CSV', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Chưa xuất được CSV')
  await page.unroute('**/api/v1/admin/reports/export.csv?**')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất CSV', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/^nang-gom-report-/)
})
