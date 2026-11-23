import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export default function SessionUnavailable() {
  const auth = useAuth()
  const [retrying, setRetrying] = useState(false)
  async function retry() {
    setRetrying(true)
    try {
      await auth.refresh()
    } finally {
      setRetrying(false)
    }
  }
  return (
    <section className="account-page container">
      <p role="alert">Chưa kiểm tra được phiên đăng nhập. Vui lòng thử lại khi kết nối ổn định.</p>
      <button className="button primary" disabled={retrying} onClick={() => void retry()}>
        {retrying ? 'Đang kiểm tra phiên…' : 'Kiểm tra lại phiên'}
      </button>
    </section>
  )
}
