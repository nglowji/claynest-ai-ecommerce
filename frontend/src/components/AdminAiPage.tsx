import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { dashboardPeriod } from '../features/dashboard/useDashboard'
import { useAdminAssistant } from '../features/admin-ai/useAdminAssistant'
import AdminAiAnswer from './AdminAiAnswer'
import AdminIcon from './AdminIcon'

const prompts = [
  {
    title: 'Bắt đầu ngày mới',
    message: 'Tôi cần ưu tiên việc gì với đơn hàng và tồn kho hiện tại?',
  },
  {
    title: 'Đọc tình hình kinh doanh',
    message: 'Tóm tắt doanh thu, đơn hoàn tất và giá trị đơn trung bình trong kỳ.',
  },
  {
    title: 'Chăm chút kho hàng',
    message: 'Những SKU nào cần kiểm tra tồn kho? Tôi nên xử lý thế nào?',
  },
  {
    title: 'Hiểu cách vận hành',
    message: 'Hướng dẫn cập nhật và duyệt tài liệu kiến thức cho AI.',
  },
]
export default function AdminAiPage() {
  const [params, setParams] = useSearchParams()
  const period = dashboardPeriod(params.get('days'))
  const assistant = useAdminAssistant()
  const [text, setText] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (assistant.entries.length) end.current?.scrollIntoView({ block: 'nearest' })
  }, [assistant.entries])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (await assistant.ask({ message: text.trim(), days: Number(period) })) {
      setText('')
      input.current?.focus()
    }
  }
  return (
    <section className="admin-dashboard admin-ai-page">
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">NÀNG GỐM · TRỢ LÝ VẬN HÀNH</p>
          <h1>Cùng bạn quản lý cửa hàng.</h1>
          <p className="dashboard-description">
            Từ câu hỏi đến số liệu, từ kiến thức đến việc cần làm.
          </p>
        </div>
        <button
          className="admin-ai-reset"
          onClick={() => {
            assistant.clear()
            setText('')
            input.current?.focus()
          }}
        >
          Bắt đầu lại
        </button>
      </header>
      <div className="admin-ai-layout">
        <aside className="admin-ai-sidebar">
          <div className="admin-ai-intro">
            <i>
              <AdminIcon name="assistant" />
            </i>
            <h2>Một góc nhìn rõ hơn.</h2>
            <p>
              Hỏi về doanh thu, hàng đợi xử lý, tồn kho hoặc cách dùng hệ thống. Mỗi câu hỏi được
              đối chiếu với dữ liệu mới và nguồn đã duyệt.
            </p>
          </div>
          <h2 className="admin-ai-sidebar-label">BẮT ĐẦU TỪ MỘT CÂU HỎI</h2>
          <div className="admin-ai-prompts">
            {prompts.map((prompt) => (
              <button
                key={prompt.title}
                disabled={assistant.busy}
                onClick={() => {
                  setText(prompt.message)
                  input.current?.focus()
                }}
              >
                <strong>{prompt.title}</strong>
                <span>{prompt.message}</span>
              </button>
            ))}
          </div>
          <div className="admin-ai-scope">
            <strong>Bạn quyết định bước tiếp theo</strong>
            <p>
              Câu trả lời kèm số liệu, nguồn và đường dẫn đến màn hình xử lý. Thông tin người nhận
              hàng không được đưa vào ngữ cảnh phân tích.
            </p>
          </div>
        </aside>
        <div className="admin-ai-workspace">
          <div className="admin-ai-toolbar">
            <span>
              <AdminIcon name="assistant" />
              Trợ lý quản trị
            </span>
            <label>
              Kỳ doanh thu
              <select
                aria-label="Kỳ dữ liệu trợ lý"
                disabled={assistant.busy}
                value={period}
                onChange={(e) => {
                  const next = new URLSearchParams(params)
                  next.set('days', e.target.value)
                  setParams(next)
                }}
              >
                <option value="7">7 ngày gần nhất</option>
                <option value="30">30 ngày gần nhất</option>
                <option value="90">90 ngày gần nhất</option>
              </select>
            </label>
          </div>
          <div className="admin-ai-conversation" aria-live="polite" aria-relevant="additions text">
            {!assistant.entries.length && (
              <div className="admin-ai-welcome">
                <span>
                  <AdminIcon name="assistant" />
                </span>
                <h2>Hôm nay cửa hàng cần gì?</h2>
                <p>Chọn một gợi ý bên cạnh hoặc viết câu hỏi của bạn bên dưới.</p>
                <small>Doanh thu theo kỳ đã chọn · Tồn kho và hàng đợi hiện tại</small>
              </div>
            )}
            {assistant.entries.map((entry) => (
              <AdminAiAnswer key={entry.id} entry={entry} />
            ))}
            {assistant.busy && (
              <p className="admin-ai-working" role="status">
                Đang đối chiếu số liệu và tìm nguồn phù hợp…
              </p>
            )}
            {assistant.notice && (
              <p className="admin-ai-notice" role="status">
                {assistant.notice}
              </p>
            )}
            {assistant.error && (
              <div className="dashboard-error" role="alert">
                <span>{assistant.error}</span>
                <button onClick={assistant.retry}>Thử lại câu hỏi</button>
              </div>
            )}
            <div ref={end} />
          </div>
          <form className="admin-ai-composer" onSubmit={submit}>
            <label htmlFor="admin-ai-question">Bạn muốn tìm hiểu điều gì?</label>
            <textarea
              ref={input}
              id="admin-ai-question"
              maxLength={1200}
              required
              rows={3}
              disabled={assistant.busy}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ví dụ: Có những đơn nào đang chờ xử lý?"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <div>
              <small>{text.length}/1200 · Ctrl + Enter để gửi</small>
              {assistant.busy ? (
                <button type="button" onClick={assistant.stop}>
                  Dừng yêu cầu
                </button>
              ) : (
                <button type="submit" disabled={!text.trim()}>
                  Gửi câu hỏi
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
