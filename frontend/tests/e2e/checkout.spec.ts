import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('guest checkout survives a lost success response and retries without creating another order', async ({
  page,
}) => {
  const product = await (await page.request.get('/api/v1/products/nang-coc-suong-mai')).json()
  const variant = product.variants[0]
  await page.goto('/products/' + product.slug)
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click()
  await page.getByRole('link', { name: 'Giỏ hàng, 2 sản phẩm', exact: true }).click()
  await expect(page.locator('.quantity span')).toHaveText('2')
  await page.reload()
  await expect(page.locator('.quantity span')).toHaveText('2')
  await page.getByRole('link', { name: 'Tiến hành đặt hàng', exact: true }).click()
  await page.getByLabel('Họ và tên người nhận', { exact: true }).fill('Khách kiểm thử')
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567')
  await page.getByLabel('Tỉnh / thành phố', { exact: true }).fill('Trà Vinh')
  await page.getByLabel('Địa chỉ nhận hàng', { exact: true }).fill('123 Đường Gốm, phường Trà Vinh')
  await page.getByLabel('Ghi chú giao hàng', { exact: true }).fill('Gọi trước khi giao')
  const submit = page.getByRole('button', { name: 'Xác nhận đặt hàng COD', exact: true })
  await expect(submit).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(submit).toBeEnabled()
  let firstKey = ''
  let firstReference = ''
  await page.route(
    '**/api/v1/orders',
    async (route) => {
      firstKey = route.request().headers()['idempotency-key']
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      firstReference = (await response.json()).reference
      await route.abort('failed')
    },
    { times: 1 },
  )
  await submit.evaluate((button) => {
    const form = (button as HTMLButtonElement).form!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await expect(
    page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true }),
  ).toBeEnabled()
  await page.reload()
  const requestPromise = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/api/v1/orders'),
  )
  await page.getByRole('button', { name: 'Kiểm tra lại đơn đã gửi', exact: true }).click()
  expect((await requestPromise).headers()['idempotency-key']).toBe(firstKey)
  await expect(page).toHaveURL('/orders/' + firstReference)
  await expect(page.locator('.order-status-pill')).toHaveText('Đang chờ xác nhận')
  await expect(page.locator('.order-info')).toContainText('Khách kiểm thử')
  const after = await (await page.request.get('/api/v1/products/' + product.slug)).json()
  expect(after.variants[0].stockQty).toBe(variant.stockQty - 2)
  await page.reload()
  await expect(page.locator('.order-status-banner')).toContainText(firstReference)
  await expect(page.getByRole('link', { name: 'Giỏ hàng, 0 sản phẩm', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('iframe').count()).toBe(0)
  await page.screenshot({ path: 'test-results/order-confirmation-mobile.png', fullPage: true })
})

test('server quote blocks excessive quantities and cart removal persists', async ({ page }) => {
  const product = await (await page.request.get('/api/v1/products/nang-coc-nau-mat')).json()
  await page.goto('/products')
  await page.evaluate(
    (id) => localStorage.setItem('nang-gom-cart-v1', JSON.stringify({ [id]: 99 })),
    product.variants[0].id,
  )
  await page.goto('/cart')
  await expect(page.getByRole('alert')).toContainText('Chỉ còn')
  await expect(page.getByRole('link', { name: 'Tiến hành đặt hàng', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^Xóa / }).click()
  await expect(
    page.getByRole('heading', { name: 'Giỏ hàng đang trống', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Giỏ hàng đang trống', exact: true }),
  ).toBeVisible()
})

test('guessing an order reference cannot expose shipping details; private code grants access', async ({
  page,
}) => {
  const product = await (await page.request.get('/api/v1/products/nang-binh-may-trang')).json()
  const csrf = async () => (await (await page.request.get('/api/v1/auth/csrf')).json()).requestToken
  const quoted = await page.request.post('/api/v1/cart/quote', {
    headers: { 'X-CSRF-TOKEN': await csrf() },
    data: { items: [{ variantId: product.variants[0].id, quantity: 1 }] },
  })
  const quote = await quoted.json()
  const placed = await page.request.post('/api/v1/orders', {
    headers: { 'X-CSRF-TOKEN': await csrf(), 'Idempotency-Key': randomUUID() },
    data: {
      quoteToken: quote.quoteToken,
      acceptTerms: true,
      contact: {
        name: 'Người nhận riêng tư',
        phone: '0901234567',
        email: '',
        province: 'Trà Vinh',
        address: '123 Địa chỉ kiểm thử riêng tư',
        note: '',
      },
    },
  })
  expect(placed.status()).toBe(201)
  const receipt = await placed.json()
  expect((await page.request.get(`/api/v1/orders/${receipt.reference}/status`)).status()).toBe(404)
  await page.goto('/orders/' + receipt.reference)
  await expect(page.locator('main')).not.toContainText('123 Địa chỉ kiểm thử riêng tư')
  await page.getByLabel('Mã truy cập riêng', { exact: true }).fill(receipt.accessToken)
  await page.getByRole('button', { name: 'Tra cứu đơn hàng', exact: true }).click()
  await expect(page.locator('.order-info')).toContainText('123 Địa chỉ kiểm thử riêng tư')
  expect(page.url()).not.toContain(receipt.accessToken)
  expect(
    (
      await page.request.get(`/api/v1/orders/${receipt.reference}/status`, {
        headers: { 'X-Order-Token': 'incorrect' },
      })
    ).status(),
  ).toBe(404)
})
