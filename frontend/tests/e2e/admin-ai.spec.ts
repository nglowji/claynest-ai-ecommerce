import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { loginAdminWithBackoff } from './support/adminLogin'

test.setTimeout(120000)

test('admin assistant returns real aggregates, period, navigation and a usable mobile workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await loginAdminWithBackoff(page)
  await page.getByRole('link', { name: 'Hỏi trợ lý', exact: true }).click()
  await expect(page).toHaveURL('/admin/assistant')
  await page.getByLabel('Kỳ dữ liệu trợ lý').selectOption('7')
  await page.getByRole('button', { name: /Đọc tình hình kinh doanh/ }).click()
  const response = page.waitForResponse(
    (res) => res.url().endsWith('/api/v1/admin/assistant') && res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()
  const answerResponse = await response
  expect(answerResponse.status()).toBe(200)
  const answer = await answerResponse.json()
  expect((Date.parse(answer.to) - Date.parse(answer.from)) / 86400000).toBe(6)
  const report = await (
    await page.request.get(`/api/v1/admin/reports?from=${answer.from}&to=${answer.to}`)
  ).json()
  const sales =
    new Intl.NumberFormat('vi-VN').format(BigInt(report.metrics.completedSalesVnd)) + ' ₫'
  expect(answer.insights.find((fact: { id: string }) => fact.id === 'sales').value).toBe(sales)
  await expect(page.locator('.admin-ai-facts').getByText(sales, { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Nguồn câu trả lời' })).toContainText(
    'Đọc báo cáo bán hàng',
  )
  await expect(page.locator('.admin-ai-facts a').first()).toHaveAttribute('href', /admin\/reports/)
  await page.screenshot({ path: 'test-results/admin-assistant-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/admin-assistant-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Bắt đầu lại', exact: true }).click()
  await expect(page.locator('.admin-ai-exchange')).toHaveCount(0)
})

test('approved RAG document is cited and revocation removes it from new admin answers', async ({
  page,
}) => {
  await loginAdminWithBackoff(page)
  async function post(path: string, data: unknown) {
    const csrf = await (await page.request.get('/api/v1/auth/csrf')).json()
    const response = await page.request.post('/api/v1/' + path, {
      headers: { 'X-CSRF-TOKEN': csrf.requestToken },
      data,
    })
    expect(response.status()).toBe(200)
    return response.json()
  }
  const title = 'Hướng dẫn RAG ' + randomUUID().slice(0, 8)
  const content = 'Dùng khăn mềm khô lau món gốm trang trí và đặt món gốm trên kệ bằng phẳng.'
  let doc = await post('admin/knowledge', {
    requestId: randomUUID(),
    title,
    content,
    sourceLabel: 'Nguồn kiểm thử được duyệt',
    topic: 'general',
  })
  await expect
    .poll(
      async () => {
        doc = await (await page.request.get('/api/v1/admin/knowledge/' + doc.id)).json()
        return doc.versions[0].indexStatus
      },
      { timeout: 20000 },
    )
    .toBe('ready')
  doc = await post('admin/knowledge/approve', {
    requestId: randomUUID(),
    documentId: doc.id,
    versionId: doc.versions[0].id,
    revision: doc.revision,
    confirmPublic: true,
  })
  await page.goto('/admin/assistant')
  await page.getByLabel('Bạn muốn tìm hiểu điều gì?').fill('RAG: lau gốm trang trí như thế nào?')
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()
  await expect(page.locator('.admin-ai-sources')).toContainText(content)
  const href = await page.locator('.admin-ai-sources a').getAttribute('href')
  expect(href).toMatch(/^\/knowledge\//)
  await post('admin/knowledge/revoke', {
    requestId: randomUUID(),
    documentId: doc.id,
    versionId: doc.versions[0].id,
    revision: doc.revision,
  })
  const next = await post('admin/assistant', {
    message: 'RAG: lau gốm trang trí như thế nào?',
    days: 30,
  })
  expect(next.sources).toHaveLength(0)
  expect(
    (await page.request.get('/api/v1/knowledge/sources/' + href!.split('/')[2])).status(),
  ).toBe(404)
})

test('assistant handles unavailable service, retries and cancels without blocking navigation', async ({
  page,
}) => {
  await loginAdminWithBackoff(page)
  await page.goto('/admin/assistant')
  await page.route('**/api/v1/admin/assistant', (route) =>
    route.fulfill({ status: 503, json: { title: 'Trợ lý đang bận.' } }),
  )
  await page.getByLabel('Bạn muốn tìm hiểu điều gì?').fill('Cần làm gì hôm nay?')
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()
  await expect(page.getByRole('alert')).toContainText('Trợ lý đang bận.')
  await page.unroute('**/api/v1/admin/assistant')
  await page.getByRole('button', { name: 'Thử lại câu hỏi' }).click()
  await expect(page.locator('.admin-ai-exchange')).toHaveCount(1)
  await page.route('**/api/v1/admin/assistant', () => new Promise(() => {}))
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click()
  await page.getByRole('button', { name: 'Dừng yêu cầu' }).click()
  await expect(page.getByRole('status')).toContainText('Đã dừng yêu cầu.')
  await page
    .getByRole('navigation', { name: 'Điều hướng quản trị' })
    .getByRole('link', { name: 'Đơn hàng', exact: true })
    .click()
  await expect(page).toHaveURL('/admin/orders')
})
