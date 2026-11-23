import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('admin creates draft, publishes, edits price, uploads image and archives; storefront follows DB', async ({
  page,
}) => {
  const key = randomUUID().replaceAll('-', '').slice(0, 12)
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/admin')
  await page.getByRole('link', { name: 'Sản phẩm & danh mục', exact: true }).click()
  await expect(page).toHaveURL('/admin/products')
  await page.getByRole('button', { name: 'Tạo sản phẩm', exact: true }).click()
  await page.getByLabel('Tên sản phẩm', { exact: true }).fill('E2E Gốm ' + key)
  const slug = await page.getByLabel('Slug', { exact: true }).inputValue()
  await page
    .getByLabel('Mô tả', { exact: true })
    .fill('Sản phẩm tổng hợp dành cho kiểm thử trình duyệt.')
  await page.getByLabel('SKU', { exact: true }).fill('E2E-' + key.toUpperCase())
  await page.getByLabel('Giá bán (VND)', { exact: true }).fill('250000')
  await page.getByLabel('Giá niêm yết (VND)', { exact: true }).fill('300000')
  await page.getByRole('button', { name: '+ Dùng ảnh có sẵn', exact: true }).click()
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu sản phẩm' })).toBeVisible()
  expect((await page.request.get('/api/v1/products/' + slug)).status()).toBe(404)
  await page.getByLabel('Xuất bản lên cửa hàng', { exact: true }).check()
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đang được giới thiệu' })).toBeVisible()
  const published = await page.request.get('/api/v1/products/' + slug)
  expect(published.status()).toBe(200)
  const product = await published.json()
  expect(product.variants[0].priceVnd).toBe(250000)
  expect(product.variants[0].discountPercent).toBe(17)
  await page.getByLabel('Giá bán (VND)', { exact: true }).fill('240000')
  await page.getByLabel('Tải PNG/JPEG ≤ 5 MB').setInputFiles({
    name: 'cup.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(page.getByRole('status').filter({ hasText: 'Đã tải ảnh' })).toBeVisible()
  await page.getByRole('button', { name: 'Lưu sản phẩm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu sản phẩm' })).toBeVisible()
  await page.screenshot({ path: 'test-results/admin-catalog.png', fullPage: true })
  await page.goto('/products/' + slug)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E Gốm ' + key)
  await expect(page.locator('.current-price')).toContainText('240.000')
  await expect(page.locator('.original-price')).toContainText('300.000')
  await expect(page.getByRole('button', { name: 'Tạm hết hàng', exact: true })).toBeDisabled()
  await expect(page.locator('.product-thumbnails button')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/product-detail.png', fullPage: true })
  const imageUrl = (await (await page.request.get('/api/v1/products/' + slug)).json()).images[1].url
  expect((await page.request.get(imageUrl)).status()).toBe(200)
  await page.goto('/admin/products')
  await page.getByLabel('Tìm tên hoặc SKU').fill(key)
  const row = page.getByRole('row').filter({ hasText: 'E2E Gốm ' + key })
  await expect(row).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Lưu trữ', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu trữ' })).toBeVisible()
  expect((await page.request.get('/api/v1/products/' + slug)).status()).toBe(404)
})

test('public catalog filters on server and retries a network error', async ({ page }) => {
  const all = await (await page.request.get('/api/v1/products?pageSize=48')).json()
  const affordable = all.items.filter((p: { variants: { priceVnd: number }[] }) =>
    p.variants.some((v) => v.priceVnd <= 1000000),
  ).length
  await page.goto('/products')
  await expect(page.locator('.product-card')).toHaveCount(Math.min(12, all.totalCount))
  await page.locator('.catalog-refine summary').click()
  await page.getByLabel('Giá đến', { exact: true }).fill('1000000')
  await expect(page.locator('.product-card')).toHaveCount(Math.min(12, affordable))
  await page.getByLabel('Còn hàng', { exact: true }).check()
  const stocked = all.items.filter((p: { variants: { priceVnd: number; stockQty: number }[] }) =>
    p.variants.some((v) => v.priceVnd <= 1000000 && v.stockQty > 0),
  ).length
  await expect(page.locator('.product-card')).toHaveCount(Math.min(12, stocked))
  await page.route('**/api/v1/products?**', (route) => route.abort())
  await page.getByLabel('Còn hàng', { exact: true }).uncheck()
  await expect(page.getByRole('alert')).toContainText('Chưa tải được sản phẩm')
  await page.unroute('**/api/v1/products?**')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(Math.min(12, affordable))
})

test('catalog is readable on mobile', async ({ page }) => {
  const all = await (await page.request.get('/api/v1/products?pageSize=48')).json()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/products')
  await expect(page.locator('.product-card')).toHaveCount(Math.min(12, all.totalCount))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: 'test-results/catalog-mobile.png', fullPage: true })
})

test('supplier product images are absent from public pages', async ({ page }) => {
  await page.goto('/products/ly-co-quai')
  await expect(
    page.getByRole('heading', { name: 'Sản phẩm không còn được giới thiệu.' }),
  ).toBeVisible()
  for (const route of ['/', '/products', '/login', '/register']) {
    await page.goto(route)
    await expect(page.locator('img[src^="/images/catalog/"]')).toHaveCount(0)
  }
})

test('studio collection has thirty distinct products with independent images and specifications', async ({
  page,
}) => {
  const response = await page.request.get('/api/v1/products?pageSize=48')
  const result = await response.json()
  const collection = result.items.filter((p: { slug: string }) => p.slug.startsWith('nang-'))
  expect(collection).toHaveLength(30)
  expect(new Set(collection.map((p: { images: { url: string }[] }) => p.images[0].url)).size).toBe(
    30,
  )
  await page.goto('/products/nang-coc-suong-mai')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cốc Sương Mai')
  await expect(page.locator('.current-price')).toContainText('260.000')
  await expect(page.locator('.original-price')).toContainText('310.000')
  await expect(page.locator('.product-specs')).toContainText('300 ml')
  await expect(page.locator('.product-specs')).toContainText('320 g')
  await expect(page.locator('.product-specs')).toContainText('Gốm sành')
  const image = page.locator('.product-gallery>img')
  await expect(image).toHaveJSProperty('complete', true)
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth > 0)).toBe(true)
  await expect(page.locator('main')).not.toContainText(/DEMO|minh họa|tham khảo/i)
})
