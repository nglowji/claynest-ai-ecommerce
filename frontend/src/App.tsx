import { useEffect, useState } from 'react'

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
type Connection = 'checking' | 'online' | 'offline'

export default function App() {
  const [connection, setConnection] = useState<Connection>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setConnection('checking')
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    async function check() {
      try {
        const response = await fetch(`${apiBase}/health`, { signal: controller.signal })
        const data: unknown = await response.json()
        if (!response.ok || typeof data !== 'object' || data === null ||
            !('status' in data) || data.status !== 'ok') throw new Error('Unavailable')
        if (active) setConnection('online')
      } catch {
        if (active) setConnection('offline')
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void check()
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [attempt])

  return (
    <main>
      <header><a className="brand" href="/">ClayNest <span>AI</span></a><span className="phase">Bản phát triển · P0</span></header>
      <section className="intro" aria-labelledby="title">
        <p className="eyebrow">ĐẤT • LỬA • BÀN TAY</p>
        <h1 id="title">Một chút mộc.<br />Một góc bình yên.</h1>
        <p className="description">Không gian gốm thủ công ClayNest đang được xây dựng, từ những nền tảng đầu tiên.</p>
        <div className="note">Danh mục sản phẩm và trải nghiệm mua sắm sẽ có trong các giai đoạn tiếp theo.</div>
      </section>
      <section className="connection" aria-labelledby="connection-title">
        <div><p className="eyebrow">KẾT NỐI ỨNG DỤNG</p><h2 id="connection-title">Trạng thái dịch vụ</h2>
          <p role="status" aria-live="polite" className={`status ${connection}`}>
            <span aria-hidden="true" className="dot" />
            {connection === 'checking' ? 'Đang kiểm tra kết nối…' : connection === 'online' ? 'Backend đang hoạt động' : 'Chưa kết nối được backend'}
          </p>
          <p className="hint">{connection === 'offline' ? 'Hãy khởi động backend rồi thử lại.' : 'Trạng thái này kiểm tra API; chưa xác nhận kết nối cơ sở dữ liệu.'}</p>
        </div>
        <button onClick={() => setAttempt(value => value + 1)} disabled={connection === 'checking'}>Kiểm tra lại <span aria-hidden="true">↗</span></button>
      </section>
      <footer><span>ClayNest AI</span><span>Gốm thủ công · Việt Nam</span></footer>
    </main>
  )
}
