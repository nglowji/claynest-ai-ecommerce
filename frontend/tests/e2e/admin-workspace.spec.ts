import { test, expect } from '@playwright/test'
import { loginAdminWithBackoff } from './support/adminLogin'

test.setTimeout(120000)
test('shared admin workspace searches real screens and mobile menu supports keyboard and navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await loginAdminWithBackoff(page)
  await page.getByRole('button', { name: 'Thu gọn menu quản trị' }).click()
  await expect(page.locator('.admin-shell')).toHaveClass(/admin-sidebar-compact/)
  await expect(
    page.locator('.admin-sidebar').getByRole('link', { name: 'Khách hàng', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.locator('.admin-shell')).toHaveClass(/admin-sidebar-compact/)
  await page.getByRole('button', { name: 'Mở rộng menu quản trị' }).click()
  await expect(page.locator('.admin-shell')).not.toHaveClass(/admin-sidebar-compact/)
  await page.goto('/admin/products')
  const pagination = page.getByRole('navigation', { name: 'Phân trang danh sách' })
  await expect(page.locator('.catalog-table tbody tr')).toHaveCount(10)
  const firstName = await page.locator('.admin-product-cell strong').first().innerText()
  await pagination.getByRole('button', { name: 'Trang 2', exact: true }).click()
  await expect(pagination.getByRole('button', { name: 'Trang 2', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.locator('.admin-product-cell strong').first()).not.toHaveText(firstName)
  await pagination.getByRole('button', { name: 'Trang trước', exact: true }).click()
  await expect(page.locator('.admin-product-cell strong').first()).toHaveText(firstName)
  await expect(page.getByLabel('Tên danh mục', { exact: true })).not.toBeVisible()
  await page.getByText('Quản lý danh mục', { exact: true }).click()
  await expect(page.getByLabel('Tên danh mục', { exact: true })).toBeVisible()
  await page.getByLabel('Phạm vi tìm kiếm').selectOption('customers')
  await page.getByLabel('Từ khóa tìm kiếm quản trị').fill('unmatched-customer-query')
  await page.getByRole('button', { name: 'Tìm trong quản trị' }).click()
  await expect(page.getByRole('heading', { name: 'Chưa tìm thấy khách hàng' })).toBeVisible()
  await page.getByRole('button', { name: 'Xóa tìm kiếm' }).click()
  const customers = await (await page.request.get('/api/v1/admin/customers')).json()
  await expect(page.locator('.admin-customers-page tbody tr')).toHaveCount(customers.items.length)
  if (customers.items.length) {
    await page.getByLabel('Tìm khách hàng', { exact: true }).fill(customers.items[0].email)
    await expect(page.locator('.admin-customers-page tbody tr')).toHaveCount(1)
    await expect(page.locator('.admin-customers-page tbody')).toContainText(customers.items[0].name)
  }
  await page.getByLabel('Phạm vi tìm kiếm').selectOption('products')
  await page.getByLabel('Từ khóa tìm kiếm quản trị').fill('Cốc')
  await page.getByRole('button', { name: 'Tìm trong quản trị' }).click()
  await expect(page).toHaveURL(/admin\/products\?q=/)
  await expect(page.getByLabel('Tìm tên hoặc mã sản phẩm')).toHaveValue('Cốc')
  await page.getByRole('button', { name: 'Tạo sản phẩm', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Sản phẩm mới' })
  await expect(editor).toBeVisible()
  await expect(editor.getByLabel('Tên sản phẩm', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(editor).not.toBeVisible()
  for (const path of [
    'products',
    'inventory',
    'orders',
    'customers',
    'reports',
    'assistant',
    'knowledge',
  ]) {
    await page.goto('/admin/' + path)
    await expect(page.locator('#admin-main h1')).toBeVisible()
    if (['products', 'inventory', 'orders', 'customers'].includes(path))
      await expect(page.locator('#admin-main .catalog-table')).toBeVisible()
    if (path === 'reports') await expect(page.locator('.report-metrics')).toBeVisible()
    await expect(page.getByRole('search', { name: 'Tìm kiếm quản trị' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto('/admin/orders')
  await expect(page.locator('.admin-orders-table')).toBeVisible()
  await page.screenshot({ path: 'test-results/admin-workspace-orders.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of [
    'products',
    'inventory',
    'orders',
    'customers',
    'reports',
    'assistant',
    'knowledge',
  ]) {
    await page.goto('/admin/' + path)
    await expect(page.locator('#admin-main h1')).toBeVisible()
    if (['products', 'inventory', 'orders', 'customers'].includes(path))
      await expect(page.locator('#admin-main .catalog-table')).toBeVisible()
    if (path === 'reports') await expect(page.locator('.report-metrics')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.goto('/admin/products')
  await page.getByRole('button', { name: 'Tạo sản phẩm', exact: true }).click()
  await expect(editor).toBeVisible()
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(editor).not.toBeVisible()
  await page.getByRole('button', { name: 'Mở menu quản trị' }).click()
  const menu = page.getByRole('dialog', { name: 'Menu quản trị' })
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await page.getByRole('button', { name: 'Mở menu quản trị' }).click()
  await menu.getByRole('link', { name: 'Quản lý kho', exact: true }).click()
  await expect(page).toHaveURL('/admin/inventory')
  await expect(menu).not.toBeVisible()
  await expect(page.locator('.inventory-page .catalog-table')).toBeVisible()
  await page.screenshot({ path: 'test-results/admin-workspace-mobile.png', fullPage: true })
})
