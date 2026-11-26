import { test, expect } from '@playwright/test'

test('ZaloPay QR stays inside checkout, survives reload and waits for server verification', async ({
  page,
}) => {
  const product = await (await page.request.get('/api/v1/products/nang-coc-suong-mai')).json()
  await page.goto('/products')
  await page.evaluate(
    (id) => localStorage.setItem('nang-gom-cart-v1', JSON.stringify({ [id]: 1 })),
    product.variants[0].id,
  )
  let receipt: { reference: string; grandTotalVnd: number; accessToken: string }
  let paid = false
  let orderCount = 0
  page.on('response', async (response) => {
    if (
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/v1/orders') &&
      response.status() === 201
    ) {
      receipt = await response.json()
      orderCount++
    }
  })
  // Gateway UI fixture; signed callbacks and server reconciliation are covered by integration tests.
  await page.route('**/api/v1/orders/*/zalopay/', async (route) => {
    expect(route.request().headers()['x-order-token']).toBe(receipt.accessToken)
    expect(route.request().postDataJSON()?.amount).toBeUndefined()
    await route.fulfill({
      json: {
        reference: receipt.reference,
        amount: receipt.grandTotalVnd,
        state: paid ? 'paid' : 'pending',
        paymentStatus: paid ? 'paid' : 'unpaid',
        qrPayload: 'https://qcgateway.zalopay.vn/payment/test',
        orderUrl: 'https://qcgateway.zalopay.vn/payment/test',
        expiresAt: new Date(Date.now() + 900000).toISOString(),
        sandbox: true,
      },
    })
  })
  await page.goto('/checkout')
  await page.getByLabel('Họ và tên người nhận', { exact: true }).fill('Khách thanh toán QR')
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567')
  await page.getByLabel('Tỉnh / thành phố', { exact: true }).fill('Trà Vinh')
  await page.getByLabel('Địa chỉ nhận hàng', { exact: true }).fill('123 Đường Gốm, phường Trà Vinh')
  await page.getByRole('radio', { name: /ZaloPay/ }).check()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Tạo mã QR ZaloPay', exact: true }).click()
  const qr = page.getByRole('img', { name: /Mã QR ZaloPay/ })
  await expect(qr).toBeVisible()
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/)
  await expect(page.locator('.zalo-amount')).not.toHaveText('0 ₫')
  await page.screenshot({ path: 'test-results/zalopay-desktop.png', fullPage: true })
  await page.reload()
  await expect(qr).toBeVisible()
  expect(orderCount).toBe(1)
  await expect(page.getByRole('link', { name: 'Giỏ hàng, 0 sản phẩm', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Kiểm tra thanh toán', exact: true }).click()
  await expect(qr).toBeVisible()
  expect(page.url()).toContain('/checkout')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('iframe').count()).toBe(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: 'test-results/zalopay-mobile.png', fullPage: true })
  paid = true
  await page.getByRole('button', { name: 'Kiểm tra thanh toán', exact: true }).click()
  await expect(page).toHaveURL('/orders/' + receipt!.reference)
  expect(orderCount).toBe(1)
})
