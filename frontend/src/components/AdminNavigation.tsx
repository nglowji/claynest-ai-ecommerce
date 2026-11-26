import { NavLink } from 'react-router-dom'
import Brand from './Brand'
import AdminIcon, { type AdminIconName } from './AdminIcon'

const groups: { title: string; links: { to: string; label: string; icon: AdminIconName }[] }[] = [
  {
    title: 'VẬN HÀNH',
    links: [
      { to: '/admin', label: 'Tổng quan', icon: 'overview' },
      { to: '/admin/orders', label: 'Đơn hàng', icon: 'orders' },
      { to: '/admin/products', label: 'Sản phẩm & danh mục', icon: 'products' },
      { to: '/admin/customers', label: 'Khách hàng', icon: 'customers' },
      { to: '/admin/inventory', label: 'Quản lý kho', icon: 'inventory' },
    ],
  },
  {
    title: 'PHÂN TÍCH & HỖ TRỢ',
    links: [
      { to: '/admin/reports', label: 'Báo cáo bán hàng', icon: 'reports' },
      { to: '/admin/assistant', label: 'Trợ lý quản trị', icon: 'assistant' },
      { to: '/admin/knowledge', label: 'Kho kiến thức AI', icon: 'knowledge' },
    ],
  },
]
export default function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="admin-sidebar-brand">
        <Brand />
        <span>KHÔNG GIAN QUẢN TRỊ</span>
      </div>
      <nav aria-label="Điều hướng quản trị">
        {groups.map((group) => (
          <div className="admin-nav-group" key={group.title}>
            <p>{group.title}</p>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin'}
                onClick={onNavigate}
                aria-label={link.label}
                title={link.label}
              >
                <AdminIcon name={link.icon} />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </>
  )
}

export function adminSection(path: string) {
  const match = groups
    .flatMap((group) => group.links)
    .filter((link) =>
      link.to === '/admin' ? path === link.to : path === link.to || path.startsWith(link.to + '/'),
    )
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label || 'Quản trị'
}
