import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('admin receives, adjusts, changes threshold and reads durable stock history', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/admin')
  const key = 'STOCK-' + randomUUID().slice(0, 8).toUpperCase()
  const categories = await (await page.request.get('/api/v1/admin/catalog/categories')).json()
  const csrf = async () => (await (await page.request.get('/api/v1/auth/csrf')).json()).requestToken
  const created = await page.request.post('/api/v1/admin/catalog/products', {
    headers: { 'X-CSRF-TOKEN': await csrf() },
    data: {
      categoryId: categories[0].id,
      name: key,
      slug: key.toLowerCase(),
      description: 'Browser inventory fixture',
      craftStory: '',
      material: 'Ceramic',
      handmadeNote: '',
      label: '',
      published: true,
      variants: [
        {
          sku: key,
          name: 'Standard',
          glaze: 'Green',
          intendedUse: 'Drink',
          priceVnd: 100000,
          active: true,
        },
      ],
      images: [{ url: '/images/slow-living/cup.jpg', alt: 'Cup' }],
    },
  })
  expect(created.status()).toBe(201)
  const product = await created.json()
  await page.getByRole('link', { name: 'Quản lý kho', exact: true }).click()
  await expect(page).toHaveURL('/admin/inventory')
  await page.getByLabel('Tìm sản phẩm hoặc SKU', { exact: true }).fill(key)
  await page.getByRole('button', { name: 'Quản lý', exact: true }).click()
  await page.getByLabel('Số lượng nhập', { exact: true }).fill('30')
  await page.getByLabel('Lý do', { exact: true }).fill('Nhập hàng kiểm thử')
  await page.getByRole('button', { name: 'Lưu thay đổi kho', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã cập nhật tồn kho' })).toBeVisible()
  await expect(page.locator('.inventory-balance strong')).toHaveText('30')
  await expect(page.locator('.inventory-history')).toContainText('Nhập hàng kiểm thử')
  await page.getByLabel('Thao tác', { exact: true }).selectOption('adjustment')
  await page.getByLabel('Số lượng thay đổi (âm để giảm)', { exact: true }).fill('-31')
  await page.getByLabel('Lý do', { exact: true }).fill('Trừ quá tồn kiểm thử')
  await page.getByRole('button', { name: 'Lưu thay đổi kho', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('không thể trừ quá')
  await expect(page.locator('.inventory-balance strong')).toHaveText('30')
  await page.getByLabel('Số lượng thay đổi (âm để giảm)', { exact: true }).fill('-2')
  await page.getByLabel('Lý do', { exact: true }).fill('Kiểm kê hư hỏng')
  await page.getByRole('button', { name: 'Lưu thay đổi kho', exact: true }).click()
  await expect(page.locator('.inventory-balance strong')).toHaveText('28')
  await page.getByLabel('Thao tác', { exact: true }).selectOption('threshold')
  await page.getByLabel('Ngưỡng cảnh báo tồn thấp', { exact: true }).fill('29')
  await page.getByLabel('Lý do', { exact: true }).fill('Đổi ngưỡng cảnh báo')
  await page.getByRole('button', { name: 'Lưu thay đổi kho', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Đã cập nhật tồn kho' })).toBeVisible()
  await page.getByLabel('Chỉ xem sắp hết hàng', { exact: true }).check()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('.stock-pill.low')).toHaveText('28')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/admin-inventory-mobile.png', fullPage: true })
  const publicProduct = await (await page.request.get('/api/v1/products/' + product.slug)).json()
  expect(publicProduct.variants[0].stockQty).toBe(28)
  const archived = await page.request.delete(
    `/api/v1/admin/catalog/products/${product.id}?revision=${product.revision}`,
    { headers: { 'X-CSRF-TOKEN': await csrf() } },
  )
  expect(archived.status()).toBe(204)
})
