import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function AdminPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  if (auth.status === 'loading') return <section className="account-page container" role="status">Đang kiểm tra phiên…</section>
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.user.role !== 'Admin') return <Navigate to="/account" replace />
  async function logout() {
    setPending(true)
    try { await auth.logout(); navigate('/login', { replace: true }) }
    catch { setError('Chưa thể đăng xuất. Vui lòng thử lại.'); setPending(false) }
  }
  return <section className="admin-page container"><div className="admin-heading"><div><p className="eyebrow">NÀNG GỐM / QUẢN TRỊ</p><h1>Một ngày mới,<br /><em>chăm chút nhà Nàng.</em></h1></div><button className="logout-button" onClick={logout} disabled={pending}>{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div>
    {error && <p role="alert" className="auth-error">{error}</p>}
    <div className="admin-welcome"><span className="admin-monogram">NG</span><div><h2>Chào {auth.user.displayName}</h2><p>{auth.user.email} · Quản trị viên</p><small>Phiên quản trị đã được xác thực bởi máy chủ.</small></div></div>
    <div className="admin-links"><Link to="/admin/products"><span>01 / CATALOG</span><h2>Chăm chút sản phẩm ↗</h2><p>Tạo sản phẩm, chỉnh biến thể, ảnh và trạng thái xuất bản.</p></Link><Link to="/"><span>02 / TRANG CHỦ</span><h2>Ghé nhà Nàng ↗</h2><p>Xem trang chủ và những câu chuyện của thương hiệu.</p></Link></div>
    <p className="admin-note">Không gian quản trị đã sẵn sàng. Catalog đã kết nối dữ liệu thật. Quản lý kho và đơn hàng sẽ được triển khai ở bước tiếp theo.</p>
  </section>
}
