import { test, expect } from '@playwright/test'

test('homepage photographs load and decode', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main img').first()).toBeVisible()
  const images = page.locator('main img')
  expect(await images.count()).toBeGreaterThanOrEqual(10)
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate(async element => {
      const image = element as HTMLImageElement
      try { await image.decode(); return image.complete && image.naturalWidth > 0 }
      catch { return false }
    })).toBe(true)
    const src = await img.getAttribute('src')
    if (src?.startsWith('/images/')) expect(src).toMatch(/\?v=[a-f0-9]{12}$/)
  }
  for (const path of ['/images/nang-gom/banner-calm.jpg', '/images/slow-living/lifestyle.jpg', '/images/nang-gom/flowers.jpg', '/images/slow-living/cup.jpg']) {
    expect(await page.locator(`main img[src^="${path}?v="]`).count()).toBeGreaterThan(0)
  }
})
