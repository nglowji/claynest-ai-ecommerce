import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AdminNavigation from './AdminNavigation'
import AdminIcon from './AdminIcon'
import Icon from './Icon'

export default function AdminToolbar({
  section,
  compact,
  onToggleSidebar,
}: {
  section: string
  compact: boolean
  onToggleSidebar: () => void
}) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const menu = useRef<HTMLDialogElement>(null)
  const [scope, setScope] = useState('orders')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    menu.current?.close()
  }, [location.pathname, location.search])
  async function logout() {
    setBusy(true)
    setError('')
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } catch {
      setError('Chưa thể đăng xuất. Vui lòng thử lại.')
      setBusy(false)
    }
  }
  function search(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    navigate('/admin/' + scope + '?q=' + encodeURIComponent(query.trim()))
  }
  const initials = (auth.user?.displayName || 'Nàng Gốm')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('vi')
  return (
    <>
      <header className="admin-workspace-top">
        <div className="admin-top-context">
          <button
            className="admin-collapse-toggle"
            onClick={onToggleSidebar}
            aria-label={compact ? 'Mở rộng menu quản trị' : 'Thu gọn menu quản trị'}
            aria-pressed={compact}
          >
            <Icon name="menu" />
          </button>
          <button
            className="admin-menu-toggle"
            onClick={() => menu.current?.showModal()}
            aria-label="Mở menu quản trị"
            aria-haspopup="dialog"
          >
            <Icon name="menu" />
          </button>
          <div className="admin-breadcrumb">
            <Link to="/admin">Quản trị</Link>
            <span aria-hidden="true">/</span>
            <strong>{section}</strong>
          </div>
        </div>
        <form
          className="admin-global-search"
          onSubmit={search}
          role="search"
          aria-label="Tìm kiếm quản trị"
        >
          <select
            aria-label="Phạm vi tìm kiếm"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value)
              setQuery((value) =>
                value.slice(
                  0,
                  e.target.value === 'orders' ? 32 : e.target.value === 'customers' ? 120 : 180,
                ),
              )
            }}
          >
            <option value="orders">Đơn hàng</option>
            <option value="products">Sản phẩm</option>
            <option value="inventory">SKU / kho</option>
            <option value="customers">Khách hàng</option>
          </select>
          <input
            type="search"
            aria-label="Từ khóa tìm kiếm quản trị"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={scope === 'orders' ? 32 : scope === 'customers' ? 120 : 180}
            placeholder="Tìm trong cửa hàng…"
          />
          <button type="submit" aria-label="Tìm trong quản trị">
            <Icon name="search" />
          </button>
        </form>
        <div className="admin-top-actions">
          <Link className="admin-store-link" to="/" aria-label="Mở cửa hàng">
            <AdminIcon name="external" />
          </Link>
          <div className="admin-profile-chip">
            <span>{initials}</span>
            <div>
              <strong>{auth.user?.displayName}</strong>
              <small>Quản trị viên</small>
            </div>
          </div>
          <button className="admin-signout" onClick={logout} disabled={busy} aria-label="Đăng xuất">
            <AdminIcon name="logout" />
          </button>
        </div>
      </header>
      {error && (
        <p className="dashboard-error admin-toolbar-error" role="alert">
          {error}
        </p>
      )}
      <dialog className="admin-mobile-menu" ref={menu} aria-label="Menu quản trị">
        <button
          className="admin-menu-close"
          onClick={() => menu.current?.close()}
          aria-label="Đóng menu quản trị"
        >
          <Icon name="close" />
        </button>
        <AdminNavigation onNavigate={() => menu.current?.close()} />
        <Link className="admin-mobile-store" to="/">
          Mở cửa hàng
        </Link>
      </dialog>
    </>
  )
}
