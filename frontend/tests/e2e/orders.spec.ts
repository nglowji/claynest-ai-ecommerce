import { loginAdminWithBackoff } from './support/adminLogin'
import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('admin fulfils COD, resolves stale state and cancels once despite double-submit and lost response', async ({
  page,
}) => {
  test.setTimeout(60000)
  const csrf = async () => (await (await page.request.get('/api/v1/auth/csrf')).json()).requestToken
  async function order(slug: string, quantity: number) {
    const product = await (await page.request.get('/api/v1/products/' + slug)).json()
    const quote = await (
      await page.request.post('/api/v1/cart/quote', {
        headers: { 'X-CSRF-TOKEN': await csrf() },
        data: { items: [{ variantId: product.variants[0].id, quantity }] },
      })
    ).json()
    const response = await page.request.post('/api/v1/orders', {
      headers: { 'X-CSRF-TOKEN': await csrf(), 'Idempotency-Key': randomUUID() },
      data: {
        quoteToken: quote.quoteToken,
        acceptTerms: true,
        contact: {
          name: 'Khách kiểm thử xử lý đơn',
          phone: '0901234567',
          email: '',
          province: 'Trà Vinh',
          address: '123 Fulfilment Test Street',
          note: 'Gọi trước khi giao',
        },
      },
    })
    expect(response.status()).toBe(201)
    return { product, receipt: await response.json() }
  }
  const completed = await order('nang-dia-canh-hoa', 2)
  const cancelled = await order('nang-khay-trang-suc-la', 1)
  test.setTimeout(120000)
  await loginAdminWithBackoff(page)
  await page.getByRole('link', { name: 'Đơn hàng', exact: true }).click()
  await expect(page).toHaveURL('/admin/orders')
  await page.getByLabel('Tìm mã đơn', { exact: true }).fill(completed.receipt.reference)
  await page.getByRole('link', { name: completed.receipt.reference, exact: true }).click()
  const id = page.url().split('/').pop()!
  const first = await (await page.request.get('/api/v1/admin/orders/' + id)).json()
  // Another accepted operation wins before the stale form submits.
  const concurrent = await page.request.patch(`/api/v1/admin/orders/${id}/status`, {
    headers: { 'X-CSRF-TOKEN': await csrf() },
    data: {
      status: 'confirmed',
      revision: first.revision,
      requestId: randomUUID(),
      reason: 'Xác nhận từ phiên quản trị khác',
    },
  })
  expect(concurrent.status()).toBe(200)
  await page.getByRole('button', { name: 'Xác nhận đơn', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Đơn đã được cập nhật')
  await expect(page.locator('.order-detail-heading .fulfilment-badge')).toHaveText('Đã xác nhận')
  await page.getByRole('button', { name: 'Xác nhận đóng gói', exact: true }).click()
  await expect(page.locator('.order-detail-heading .fulfilment-badge')).toHaveText('Đã đóng gói')
  await expect(page.getByRole('option', { name: 'Hủy đơn & hoàn kho', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Bàn giao vận chuyển', exact: true }).click()
  await expect(page.locator('.order-detail-heading .fulfilment-badge')).toHaveText('Đang giao hàng')
  const finish = page.getByRole('button', { name: 'Hoàn tất & ghi nhận COD', exact: true })
  await expect(finish).toBeDisabled()
  await page
    .getByRole('checkbox', { name: 'Đơn đã giao và đã thu đủ tiền COD.', exact: true })
    .check()
  await finish.click()
  await expect(page.locator('.order-detail-heading .fulfilment-badge')).toHaveText('Hoàn tất')
  await expect(page.locator('.fulfilment-payment')).toContainText('Đã ghi nhận thu đủ tiền COD')
  await expect(page.locator('.fulfilment-history li')).toHaveCount(5)
  await page.screenshot({ path: 'test-results/admin-order-completed-desktop.png', fullPage: true })
  const status = await (
    await page.request.get(`/api/v1/orders/${completed.receipt.reference}/status`, {
      headers: { 'X-Order-Token': completed.receipt.accessToken },
    })
  ).json()
  expect(status.status).toBe('completed')
  expect(status.paymentStatus).toBe('paid')
  expect(status.completedAt).toBeTruthy()
  expect(status.timeline).toHaveLength(5)
  expect(
    (await (await page.request.get('/api/v1/products/' + completed.product.slug)).json())
      .variants[0].stockQty,
  ).toBe(completed.product.variants[0].stockQty - 2)
  await page.getByRole('link', { name: '← Danh sách đơn hàng', exact: true }).click()
  await page.getByLabel('Tìm mã đơn', { exact: true }).fill(cancelled.receipt.reference)
  await page.getByRole('link', { name: cancelled.receipt.reference, exact: true }).click()
  const cancelId = page.url().split('/').pop()!
  await page.getByLabel('Thao tác xử lý đơn', { exact: true }).selectOption('cancelled')
  await page.getByLabel('Lý do xử lý đơn', { exact: true }).fill('Khách thay đổi nhu cầu')
  const cancel = page.getByRole('button', { name: 'Hủy đơn & hoàn kho', exact: true })
  await expect(cancel).toBeDisabled()
  await page
    .getByRole('checkbox', { name: 'Tôi xác nhận hủy đơn và hoàn kho.', exact: true })
    .check()
  let command: Record<string, unknown> = {}
  await page.route(
    '**/api/v1/admin/orders/*/status',
    async (route) => {
      command = route.request().postDataJSON()
      const result = await route.fetch()
      expect(result.status()).toBe(200)
      await route.abort('failed')
    },
    { times: 1 },
  )
  await cancel.evaluate((button) => {
    const form = (button as HTMLButtonElement).form!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  const retry = page.getByRole('button', { name: 'Kiểm tra lại thao tác', exact: true })
  await expect(retry).toBeEnabled()
  const retried = page.waitForRequest(
    (r) => r.method() === 'PATCH' && r.url().includes('/admin/orders/'),
  )
  await retry.click()
  expect((await retried).postDataJSON().requestId).toBe(command.requestId)
  await expect(page.locator('.order-detail-heading .fulfilment-badge')).toHaveText('Đã hủy')
  await expect(page.getByRole('status')).toContainText('Đã hủy đơn và hoàn kho')
  await expect(page.locator('.fulfilment-history li')).toHaveCount(2)
  const again = await page.request.patch(`/api/v1/admin/orders/${cancelId}/status`, {
    headers: { 'X-CSRF-TOKEN': await csrf() },
    data: command,
  })
  expect(again.status()).toBe(200)
  expect((await again.json()).history).toHaveLength(2)
  const after = await (await page.request.get('/api/v1/products/' + cancelled.product.slug)).json()
  expect(after.variants[0].stockQty).toBe(cancelled.product.variants[0].stockQty)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('iframe').count()).toBe(0)
  await page.screenshot({ path: 'test-results/admin-order-cancelled-mobile.png', fullPage: true })
  await page.goto('/orders/' + cancelled.receipt.reference)
  await page.getByLabel('Mã truy cập riêng', { exact: true }).fill(cancelled.receipt.accessToken)
  await page.getByRole('button', { name: 'Tra cứu đơn hàng', exact: true }).click()
  await expect(page.locator('.order-status-pill')).toHaveText('Đã hủy')
  await expect(page.locator('.order-progress li')).toHaveCount(2)
  await page.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click()
  await expect(page.locator('.order-status-pill')).toHaveText('Đã hủy')
})
