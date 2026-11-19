import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('admin indexes, versions, approves and revokes knowledge; chat and public sources obey current approval', async ({ page }) => {
  const key=randomUUID().slice(0,8)
  const title='Hướng dẫn chăm gốm '+key
  const first='Dùng khăn mềm sạch để lau món gốm trang trí. Giữ món gốm trên bề mặt bằng phẳng.'
  const second='Dùng cọ mềm khô để làm sạch các rãnh trên món gốm trang trí, sau đó lau lại bằng khăn sạch.'
  await page.goto('/login')
  await page.getByLabel('Email', { exact:true }).fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Mật khẩu', { exact:true }).fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name:'Đăng nhập', exact:true }).click()
  await expect(page).toHaveURL('/admin')
  await page.getByRole('navigation', { name:'Điều hướng quản trị' }).getByRole('link', { name:'Kho kiến thức AI' }).click()
  await page.getByRole('button', { name:'+ Thêm tài liệu' }).click()
  await page.getByLabel('Tiêu đề', { exact:true }).fill(title)
  await page.getByLabel('Nguồn / vị trí tài liệu').fill('Quy trình vệ sinh do cửa hàng xác nhận, mục 1')
  await page.getByLabel('Nạp file văn bản').setInputFiles({ name:'guide.txt', mimeType:'text/plain',buffer:Buffer.from(first,'utf8') })
  await expect(page.getByLabel('Nội dung', { exact:true })).toHaveValue(first)
  await page.getByRole('button', { name:'Lưu & xử lý' }).click()
  const detail=page.locator('.knowledge-detail')
  await expect(detail.locator('.knowledge-job')).toContainText('Sẵn sàng duyệt', { timeout:20000 })
  await expect(detail.getByRole('button', { name:'Duyệt công bố' })).toBeDisabled()
  const list=await (await page.request.get('/api/v1/admin/knowledge')).json()
  const doc=list.items.find((d: { title:string })=>d.title===title)
  async function chat() {
    const csrf=await (await page.request.get('/api/v1/auth/csrf')).json()
    const response=await page.request.post('/api/v1/chat',{headers:{'X-CSRF-TOKEN':csrf.requestToken},data:{message:'Lau gốm trang trí như thế nào?'}})
    expect(response.status()).toBe(200)
    return response.json()
  }
  expect((await chat()).sources || []).toHaveLength(0)
  await detail.getByRole('checkbox').check()
  await detail.getByRole('button', { name:'Duyệt công bố' }).click()
  await expect(detail.locator('.knowledge-metadata')).toContainText('v1')
  const answer=await chat()
  expect(answer.message).toContain(first)
  const source=answer.sources[0].url
  const chunk=source.split('/')[2].split('?')[0]
  expect((await page.request.get('/api/v1/knowledge/sources/'+chunk)).status()).toBe(200)
  await page.screenshot({path:'test-results/knowledge-admin.png',fullPage:true})
  await detail.getByRole('button', { name:'Tạo phiên bản mới' }).click()
  await page.getByLabel('Nội dung', { exact:true }).fill(second)
  await page.getByRole('button', { name:'Lưu & xử lý' }).click()
  await expect(detail.locator('.knowledge-job')).toContainText('Sẵn sàng duyệt',{timeout:20000})
  expect((await page.request.get('/api/v1/knowledge/sources/'+chunk)).status()).toBe(200)
  await detail.getByRole('checkbox').check()
  await detail.getByRole('button', { name:'Duyệt công bố' }).click()
  await expect(detail.locator('.knowledge-metadata')).toContainText('v2')
  expect((await page.request.get('/api/v1/knowledge/sources/'+chunk)).status()).toBe(404)
  const updated=await chat(); expect(updated.message).toContain(second)
  const current=updated.sources[0].url
  await page.goto(current)
  await expect(page.locator('blockquote')).toContainText(second)
  await page.getByRole('button', { name:'Hữu ích', exact:true }).click()
  await expect(page.getByRole('status').filter({hasText:'Cảm ơn bạn'})).toBeVisible()
  await page.goto('/admin/knowledge')
  await page.locator('.knowledge-list-row').filter({hasText:title}).click()
  await page.getByRole('button', { name:'Thu hồi nguồn đang dùng' }).click()
  await expect(page.locator('.knowledge-metadata')).toContainText('Chưa công bố')
  const currentChunk=current.split('/')[2].split('?')[0]
  expect((await page.request.get('/api/v1/knowledge/sources/'+currentChunk)).status()).toBe(404)
  expect((await chat()).message).not.toContain(second)
  const stored=await (await page.request.get('/api/v1/admin/knowledge/'+doc.id)).json()
  expect(stored.versions).toHaveLength(2)
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/knowledge-admin-mobile.png',fullPage:true})
})
