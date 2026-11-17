import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from './Icon'

export default function AccountPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  if (auth.status === 'loading') return <section className="account-page container"><p role="status">Đang kiểm tra phiên đăng nhập…</p></section>
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.user.role === 'Admin') return <Navigate to="/admin" replace />
  async function logout() {
    setPending(true); setError('')
    try { await auth.logout(); navigate('/login', { replace: true }) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa thể đăng xuất. Vui lòng thử lại.') }
    finally { setPending(false) }
  }
  return <section className="account-page container" aria-labelledby="account-title"><div className="account-card"><div className="account-avatar" aria-hidden="true"><Icon name="user" /></div><p className="eyebrow">GÓC NHỎ CỦA BẠN</p><h1 id="account-title">Chào {auth.user.displayName || 'bạn'},<br /><em>một ngày thật lành.</em></h1><p className="account-welcome">Bạn đã đăng nhập thành công.</p><dl className="account-details"><div><dt>Email</dt><dd>{auth.user.email}</dd></div><div><dt>Quyền truy cập</dt><dd>Khách hàng</dd></div></dl>{error && <p className="auth-error" role="alert">{error}</p>}<div className="account-actions"><Link className="button primary" to="/">Ghé cửa hàng <Icon name="arrow" /></Link><button className="logout-button" onClick={logout} disabled={pending}>{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div></div></section>
}
