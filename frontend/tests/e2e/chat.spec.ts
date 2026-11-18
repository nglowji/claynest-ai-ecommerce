import { test, expect } from '@playwright/test'

test('advice supports budget, product navigation and keyboard dismissal', async ({ page }) => {
  await page.route('**/api/v1/chat', async route => {
    const body = route.request().postDataJSON()
    expect(body.filters.maxPrice).toBe(300000)
    await route.fulfill({ json: { message: 'Một món gốm cho bạn.', products: [{ product: { variantId: '00000000-0000-0000-0000-000000000001', name: 'Cốc Sương Mai', slug: 'coc-suong-mai', priceVnd: 250000, stockQty: 30, glaze: 'Men xanh', image: '/images/slow-living/cup.jpg', capacityMl: 300 }, reason: 'Phù hợp ngân sách.' }], actions: [] } })
  })
  await page.goto('/products')
  await page.getByRole('button', { name: 'Mở tư vấn chọn gốm' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Chọn theo ngân sách', { exact: true }).click()
  await dialog.getByLabel('Ngân sách tư vấn tối đa').fill('300000')
  await dialog.getByLabel('Lời nhắn cho Nàng').fill('Tìm một chiếc cốc')
  await dialog.getByRole('button', { name: 'Gửi lời nhắn' }).click()
  await expect(dialog.locator('.chat-product')).toContainText('250.000')
  await expect(dialog.locator('.chat-product')).toContainText('Còn 30 sản phẩm')
  await expect(dialog.locator('.chat-product')).toHaveAttribute('href', /products\/coc-suong-mai\?variant=/)
  await page.screenshot({ path: 'test-results/chat-advice.png' })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('advice failure can retry and a pending turn can stop without blocking the shop', async ({ page }) => {
  let calls = 0
  await page.route('**/api/v1/chat', async route => {
    calls++
    if (calls === 1) await route.fulfill({ status: 503, json: { title: 'Tư vấn đang bận.' } })
    else await route.fulfill({ json: { message: 'Nàng đã sẵn sàng.', products: [], actions: [] } })
  })
  await page.goto('/products')
  await page.getByRole('button', { name: 'Mở tư vấn chọn gốm' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Lời nhắn cho Nàng').fill('Chọn quà')
  await dialog.getByRole('button', { name: 'Gửi lời nhắn' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Tư vấn đang bận.')
  await dialog.getByRole('button', { name: 'Thử lại tư vấn' }).click()
  await expect(dialog).toContainText('Nàng đã sẵn sàng.')
  await page.unroute('**/api/v1/chat')
  await page.route('**/api/v1/chat', () => new Promise(() => {}))
  await dialog.getByLabel('Lời nhắn cho Nàng').fill('Thêm lựa chọn')
  await dialog.getByRole('button', { name: 'Gửi lời nhắn' }).click()
  await dialog.getByRole('button', { name: 'Dừng tư vấn' }).click()
  await expect(dialog).toContainText('Đã dừng tư vấn.')
  await dialog.getByRole('button', { name: 'Đóng tư vấn' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})


test('knowledge answers show versioned sources on mobile and link to the store flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/v1/chat', route => route.fulfill({ json: {
    message: 'Phí giao hàng 30.000 đ. Miễn phí từ 800.000 đ.', products: [], actions: [{ label: 'Giao hàng và đóng gói', url: '/cart' }],
    sources: [{ title: 'Nàng Gốm · Hướng dẫn cửa hàng', section: 'Giao hàng và đóng gói', version: '2026-11-18.1', url: '/cart' }]
  } }))
  await page.goto('/products')
  await page.getByRole('button', { name: 'Mở tư vấn chọn gốm' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Lời nhắn cho Nàng').fill('Phí giao hàng?')
  await dialog.getByRole('button', { name: 'Gửi lời nhắn' }).click()
  const sources = dialog.getByLabel('Nguồn thông tin')
  await expect(sources).toContainText('Phiên bản 2026-11-18.1')
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/chat-knowledge-mobile.png' })
  await sources.getByRole('link').click()
  await expect(page).toHaveURL('/cart')
  await expect(dialog).not.toBeVisible()
})
