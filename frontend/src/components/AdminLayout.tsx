import SessionUnavailable from './SessionUnavailable'
import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { adminSession, AuthError } from '../auth/api'
import AdminNavigation, { adminSection } from './AdminNavigation'
import AdminToolbar from './AdminToolbar'
import AdminIcon from './AdminIcon'

export default function AdminLayout() {
  const auth = useAuth()
  const location = useLocation()
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem('nang-gom-admin-sidebar') === 'compact'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('nang-gom-admin-sidebar', compact ? 'compact' : 'expanded')
    } catch {
      /* Layout remains usable without storage. */
    }
  }, [compact])
  const [verifiedPath, setVerifiedPath] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [denied, setDenied] = useState(false)
  useEffect(() => {
    document.title = adminSection(location.pathname) + ' | Nàng Gốm'
  }, [location.pathname])
  useEffect(() => {
    let active = true
    if (auth.user?.role !== 'Admin') return
    setError('')
    setVerifiedPath('')
    adminSession()
      .then(() => {
        if (active) setVerifiedPath(location.pathname)
      })
      .catch((failure) => {
        if (!active) return
        if (failure instanceof AuthError && failure.status === 401) auth.expire()
        else if (failure instanceof AuthError && failure.status === 403) {
          setDenied(true)
          void auth.refresh()
        } else setError('Chưa kết nối được không gian quản trị. Vui lòng thử lại.')
      })
    return () => {
      active = false
    }
  }, [auth.user?.id, auth.user?.role, location.pathname, attempt])
  if (auth.status === 'loading')
    return (
      <main className="account-page container" role="status">
        Đang kiểm tra phiên…
      </main>
    )
  if (auth.status === 'unavailable') return <SessionUnavailable />
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.user.role !== 'Admin' || denied) return <Navigate to="/account" replace />
  const section = adminSection(location.pathname)
  return (
    <div className={'admin-shell admin-workspace' + (compact ? ' admin-sidebar-compact' : '')}>
      <a className="skip-link" href="#admin-main">
        Đến nội dung quản trị
      </a>
      <aside className="admin-sidebar">
        <AdminNavigation />
        <div className="admin-sidebar-bottom">
          <span className="admin-workspace-label">NÀNG GỐM WORKSPACE</span>
          <Link to="/">
            <AdminIcon name="external" />
            Ghé cửa hàng
          </Link>
        </div>
      </aside>
      <div className="admin-workspace-body">
        <AdminToolbar
          section={section}
          compact={compact}
          onToggleSidebar={() => setCompact((value) => !value)}
        />
        <main id="admin-main">
          {error ? (
            <section className="account-page container">
              <p role="alert">{error}</p>
              <button className="button primary" onClick={() => setAttempt((value) => value + 1)}>
                Thử lại
              </button>
            </section>
          ) : verifiedPath === location.pathname ? (
            <Outlet />
          ) : (
            <p className="account-page container" role="status">
              Đang xác thực quyền quản trị…
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
