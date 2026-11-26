import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { reorderCart } from '../../src/features/checkout/purchases'

test('customer returns to checkout, sees private purchase history, filters, pages and reorders', async ({
  page,
}) => {
  test.setTimeout(120000)
  const csrf = async () => (await (await page.request.get('/api/v1/auth/csrf')).json()).requestToken
  const email = `purchase-${randomUUID()}@example.test`,
    password = `Purchase-${randomUUID()}-Aa1!`
  expect(
    (
      await page.request.post('/api/v1/auth/register', {
        headers: { 'X-CSRF-TOKEN': await csrf() },
        data: { displayName: 'Người Mua Hàng', email, password },
      })
    ).status(),
  ).toBe(201)
  const product = await (await page.request.get('/api/v1/products/nang-coc-suong-mai')).json()
  const variant = product.variants.find(
    (v: { active: boolean; stockQty: number }) => v.active && v.stockQty >= 6,
  )
  expect(variant).toBeTruthy()
  await page.goto('/products/' + product.slug)
  await page.evaluate(
    (id) => localStorage.setItem('nang-gom-cart-v1', JSON.stringify({ [id]: 1 })),
    variant.id,
  )
  await page.goto('/checkout')
  await page
    .locator('.checkout-signin')
    .getByRole('link', { name: 'đăng nhập', exact: true })
    .click()
  await expect(page).toHaveURL(/login\?next=/)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/checkout')
  await expect(page.getByLabel('Họ và tên người nhận', { exact: true })).toHaveValue(
    'Người Mua Hàng',
  )
  await expect(page.getByLabel('Email nhận hàng', { exact: true })).toHaveValue(email)
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567')
  await page.getByLabel('Tỉnh / thành phố', { exact: true }).fill('Trà Vinh')
  await page
    .getByLabel('Địa chỉ nhận hàng', { exact: true })
    .fill('123 Private Customer Purchase Street')
  await expect(page.locator('.checkout-summary li')).toHaveCount(1)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Xác nhận đặt hàng COD', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\/NG-/)
  const reference = page.url().split('/').pop()!
  await expect(page.locator('.order-info')).toContainText('123 Private Customer Purchase Street')
  for (let n = 0; n < 5; n++) {
    const quote = await (
      await page.request.post('/api/v1/cart/quote', {
        headers: { 'X-CSRF-TOKEN': await csrf() },
        data: { items: [{ variantId: variant.id, quantity: 1 }] },
      })
    ).json()
    const placed = await page.request.post('/api/v1/orders', {
      headers: { 'X-CSRF-TOKEN': await csrf(), 'Idempotency-Key': randomUUID() },
      data: {
        quoteToken: quote.quoteToken,
        acceptTerms: true,
        contact: {
          name: 'Người Mua Hàng',
          phone: '0901234567',
          email,
          province: 'Trà Vinh',
          address: '123 Private Customer Purchase Street',
          note: '',
        },
      },
    })
    expect(placed.status()).toBe(201)
  }
  await page.getByRole('link', { name: 'Đơn hàng đã mua', exact: true }).click()
  await expect(page.locator('.purchase-card')).toHaveCount(5)
  await page.getByRole('button', { name: 'Trang 2', exact: true }).click()
  await expect(page.locator('.purchase-card')).toHaveCount(1)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Trang 2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByLabel('Lọc trạng thái đơn đã mua', { exact: true }).selectOption('completed')
  await expect(page.getByRole('heading', { name: 'Chưa có đơn phù hợp' })).toBeVisible()
  await page.getByLabel('Lọc trạng thái đơn đã mua', { exact: true }).selectOption('pending')
  await page.getByLabel('Tìm mã đơn đã mua', { exact: true }).fill(reference)
  await expect(page.locator('.purchase-card')).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/purchases-mobile.png', fullPage: true })
  await page.getByRole('link', { name: 'Theo dõi đơn', exact: true }).click()
  await expect(page.locator('.order-progress')).toBeVisible()
  await expect(page.locator('.order-info')).toContainText('123 Private Customer Purchase Street')
  await page.goto('/account/orders?q=' + reference)
  await page.getByRole('button', { name: 'Mua lại', exact: true }).click()
  await expect(page).toHaveURL('/cart')
  await expect(page.getByRole('link', { name: 'Giỏ hàng, 1 sản phẩm', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tiến hành đặt hàng', exact: true })).toBeEnabled()
})

test('reorder preserves existing cart and respects stock, quantity and line limits', () => {
  const item = {
    variantId: 'item',
    slug: 'product',
    name: 'Product',
    variantName: 'Variant',
    image: '',
    quantity: 4,
    lineTotalVnd: 1,
    availableQty: 5,
  }
  expect(reorderCart({ item: 3 }, [item])).toEqual({ cart: { item: 5 }, added: 2 })
  expect(reorderCart({ item: 8 }, [item])).toEqual({ cart: { item: 8 }, added: 0 })
  expect(reorderCart({}, [{ ...item, slug: null }])).toEqual({ cart: {}, added: 0 })
  const full = Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['id' + i, 1]))
  expect(reorderCart(full, [item])).toEqual({ cart: full, added: 0 })
  expect(reorderCart({ item: 98 }, [{ ...item, availableQty: 500 }])).toEqual({
    cart: { item: 99 },
    added: 1,
  })
})
