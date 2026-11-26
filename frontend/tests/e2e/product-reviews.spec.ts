import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { loginAdminWithBackoff } from './support/adminLogin'

test('product gallery, specifications and verified purchase reviews persist and update', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000)
  const buyer = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  try {
    const buyerPage = await buyer.newPage()
    buyerPage.setDefaultTimeout(15000)
    const csrf = async () =>
      (await (await buyer.request.get('/api/v1/auth/csrf')).json()).requestToken
    const email = `review-${randomUUID()}@example.test`,
      password = `Review-${randomUUID()}-Aa1!`
    const registration = await buyer.request.post('/api/v1/auth/register', {
      headers: { 'X-CSRF-TOKEN': await csrf() },
      data: { displayName: 'Người Mua Gốm', email, password },
    })
    expect(registration.status()).toBe(201)
    const login = await buyer.request.post('/api/v1/auth/login', {
      headers: { 'X-CSRF-TOKEN': await csrf() },
      data: { email, password, rememberMe: false },
    })
    expect(login.status()).toBe(200)
    const catalog = await (
      await buyer.request.get('/api/v1/products?inStock=true&pageSize=48')
    ).json()
    const product = catalog.items.find((p: { variants: { active: boolean; stockQty: number }[] }) =>
      p.variants.some((v) => v.active && v.stockQty > 0),
    )
    const variant = product.variants.find(
      (v: { active: boolean; stockQty: number }) => v.active && v.stockQty > 0,
    )
    await buyerPage.goto('/products/' + product.slug)
    await expect(buyerPage.getByRole('heading', { level: 1 })).toHaveText(product.name)
    await expect(buyerPage.locator('.product-specs')).toContainText(product.material)
    await buyerPage
      .getByRole('button', { name: 'Phóng to ảnh ' + product.name, exact: true })
      .click()
    await expect(buyerPage.getByRole('dialog')).toBeVisible()
    await buyerPage.keyboard.press('Escape')
    await expect(buyerPage.getByRole('dialog')).not.toBeVisible()
    await expect(buyerPage.locator('.review-compose')).toContainText('đã hoàn tất')
    const quote = await (
      await buyer.request.post('/api/v1/cart/quote', {
        headers: { 'X-CSRF-TOKEN': await csrf() },
        data: { items: [{ variantId: variant.id, quantity: 1 }] },
      })
    ).json()
    const placed = await buyer.request.post('/api/v1/orders', {
      headers: { 'X-CSRF-TOKEN': await csrf(), 'Idempotency-Key': randomUUID() },
      data: {
        quoteToken: quote.quoteToken,
        acceptTerms: true,
        contact: {
          name: 'Người Mua Gốm',
          phone: '0901234567',
          email,
          province: 'Trà Vinh',
          address: '123 Product Review Test Street',
          note: '',
        },
      },
    })
    expect(placed.status()).toBe(201)
    const receipt = await placed.json()
    await loginAdminWithBackoff(page)
    const orders = await (
      await page.request.get('/api/v1/admin/orders/?q=' + receipt.reference)
    ).json()
    let revision = orders.items[0].revision
    for (const status of ['confirmed', 'packed', 'shipped', 'completed']) {
      const token = (await (await page.request.get('/api/v1/auth/csrf')).json()).requestToken
      const changed = await page.request.patch(
        `/api/v1/admin/orders/${orders.items[0].id}/status`,
        {
          headers: { 'X-CSRF-TOKEN': token },
          data: {
            status,
            revision,
            requestId: randomUUID(),
            reason: 'Review eligibility browser test',
            confirmCodCollected: status === 'completed',
          },
        },
      )
      expect(changed.status()).toBe(200)
      revision = (await changed.json()).revision
    }
    const eligibility = await buyer.request.get(`/api/v1/products/${product.id}/reviews/mine`)
    expect(eligibility.status()).toBe(200)
    expect((await eligibility.json()).eligible).toBe(true)
    await buyerPage.reload()
    await buyerPage.getByLabel('Điểm đánh giá', { exact: true }).selectOption('4')
    await buyerPage
      .getByLabel('Nội dung đánh giá', { exact: true })
      .fill('Màu men đẹp, kích thước vừa tay và đóng gói cẩn thận.')
    await buyerPage.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click()
    await expect(buyerPage.locator('.buyer-review')).toContainText('Đã mua hàng')
    await expect(buyerPage.locator('.buyer-review')).toContainText('Màu men đẹp')
    await buyerPage.reload()
    await buyerPage.getByLabel('Điểm đánh giá', { exact: true }).selectOption('3')
    await buyerPage
      .getByLabel('Nội dung đánh giá', { exact: true })
      .fill('Sau khi sử dụng, mình thích chất men và cách hoàn thiện.')
    await buyerPage.getByRole('button', { name: 'Cập nhật đánh giá', exact: true }).click()
    await expect(buyerPage.locator('.buyer-review')).toHaveCount(1)
    await expect(buyerPage.locator('.buyer-review')).toContainText('Sau khi sử dụng')
    await buyerPage.getByLabel('Lọc đánh giá', { exact: true }).selectOption('5')
    await expect(buyerPage.locator('.review-empty')).toContainText(
      'Chưa có đánh giá với số sao này',
    )
    await buyerPage.setViewportSize({ width: 390, height: 844 })
    expect(await buyerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    )
    await buyerPage.screenshot({ path: 'test-results/product-reviews-mobile.png', fullPage: true })
    const publicReview = await (
      await page.request.get(`/api/v1/products/${product.id}/reviews/`)
    ).json()
    expect(publicReview.totalCount).toBe(1)
    expect(publicReview.averageRating).toBe(3)
    expect(JSON.stringify(publicReview)).not.toContain(email)
  } finally {
    await buyer.close().catch(() => {})
  }
})
