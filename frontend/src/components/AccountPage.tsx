import SiteImage from './SiteImage'
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
  return <section className="account-page personal-page container" aria-labelledby="account-title">
    <nav className="breadcrumbs" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><span>Tài khoản</span></nav>
    <div className="personal-heading"><p className="eyebrow">GÓC NHỎ CỦA BẠN</p><h1 id="account-title">Chào {auth.user.displayName || 'bạn'},<br /><em>một ngày thật lành.</em></h1><p>Thật vui vì bạn ghé nhà Nàng.</p></div>
    <div className="personal-layout"><aside className="personal-sidebar"><div className="personal-identity"><div className="account-avatar" aria-hidden="true">{(auth.user.displayName || auth.user.email).slice(0,1).toLocaleUpperCase('vi')}</div><strong>{auth.user.displayName || 'Bạn của Nàng'}</strong><span>Khách hàng Nàng Gốm</span></div><a className="personal-nav active" href="#profile"><Icon name="user" /> Thông tin cá nhân</a><Link className="personal-nav" to="/orders"><Icon name="gift" /> Tra cứu đơn hàng</Link><Link className="personal-nav" to="/cart"><Icon name="bag" /> Giỏ hàng của bạn</Link><button className="personal-nav" onClick={logout} disabled={pending}>{pending ? 'Đang đăng xuất…' : 'Đăng xuất'} <Icon name="arrow" /></button></aside>
    <div className="personal-main"><section className="profile-panel" id="profile"><div className="profile-title"><div><p className="eyebrow">HỒ SƠ CỦA BẠN</p><h2>Thông tin cá nhân</h2></div><Icon name="user" /></div><p className="profile-intro">Thông tin tài khoản bạn đang sử dụng tại Nàng Gốm.</p><dl className="account-details"><div><dt>Họ và tên</dt><dd>{auth.user.displayName || 'Chưa cung cấp'}</dd></div><div><dt>Địa chỉ email</dt><dd>{auth.user.email}</dd></div><div><dt>Loại tài khoản</dt><dd>Khách hàng</dd></div></dl>{error && <p className="auth-error" role="alert">{error}</p>}</section>
    <Link className="personal-inspiration" to="/products"><SiteImage src="/images/nang-gom/flowers.jpg" alt="Một góc nhà với bình hoa và ánh nắng" /><div><p className="eyebrow">DÀNH MỘT CHÚT CHO MÌNH</p><h2>Một món gốm nhỏ.<br /><em>Một niềm vui mới.</em></h2><span>Khám phá cửa hàng <Icon name="arrow" /></span></div></Link></div></div></section>
}
