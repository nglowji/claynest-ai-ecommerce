import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { adminSession, AuthError } from '../auth/api'
import Brand from './Brand'

export default function AdminLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [verifiedPath, setVerifiedPath] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [denied, setDenied] = useState(false)
  useEffect(() => { document.title = 'Quản trị | Nàng Gốm' }, [])
  useEffect(() => {
    let active = true
    if (auth.user?.role !== 'Admin') return
    setError(''); setVerifiedPath('')
    adminSession().then(() => { if (active) setVerifiedPath(location.pathname) }).catch(failure => {
      if (!active) return
      if (failure instanceof AuthError && failure.status === 401) auth.expire()
      else if (failure instanceof AuthError && failure.status === 403) { setDenied(true); void auth.refresh() }
      else setError('Chưa kết nối được không gian quản trị. Vui lòng thử lại.')
    })
    return () => { active = false }
  }, [auth.user?.id, auth.user?.role, location.pathname, attempt])
  if (auth.status === 'loading') return <main className="account-page container" role="status">Đang kiểm tra phiên…</main>
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.user.role !== 'Admin' || denied) return <Navigate to="/account" replace />
  return <div className="admin-shell"><a className="skip-link" href="#admin-main">Đến nội dung quản trị</a><header className="admin-topbar"><Brand /><nav aria-label="Điều hướng quản trị"><Link to="/admin" aria-current={location.pathname === '/admin' ? 'page' : undefined}>Tổng quan</Link><Link to="/admin/products">Sản phẩm & danh mục</Link><Link to="/admin/inventory">Quản lý kho</Link><Link to="/admin/orders" aria-current={location.pathname.startsWith('/admin/orders') ? 'page' : undefined}>Đơn hàng</Link><Link to="/">Ghé cửa hàng ↗</Link></nav></header><main id="admin-main">{error ? <section className="account-page container"><p role="alert">{error}</p><button className="button primary" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></section> : verifiedPath === location.pathname ? <Outlet /> : <p className="account-page container" role="status">Đang xác thực quyền quản trị…</p>}</main></div>
}
