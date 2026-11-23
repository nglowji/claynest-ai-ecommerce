import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import { catalogRequest, type PageResult } from '../catalog/api'
import { listOrders, orderLabels, type OrderRow } from '../features/orders/adminApi'
import { money } from '../data/products'
import AdminIcon, { type AdminIconName } from './AdminIcon'

type Summary = {
  products: number
  pending: number
  shipped: number
  lowStock: number
  recent: OrderRow[]
}
export default function AdminPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const params = (status?: string) =>
      new URLSearchParams({ page: '1', pageSize: '6', ...(status ? { status } : {}) })
    Promise.all([
      catalogRequest<PageResult<unknown>>('admin/catalog/products?page=1&pageSize=1', {
        signal: controller.signal,
      }),
      listOrders(params('pending'), controller.signal),
      listOrders(params('shipped'), controller.signal),
      catalogRequest<PageResult<unknown>>('admin/inventory/?lowOnly=true&page=1&pageSize=1', {
        signal: controller.signal,
      }),
      listOrders(params(), controller.signal),
    ])
      .then(([products, orders, shipped, stock, recent]) => {
        if (!controller.signal.aborted) {
          setData({
            products: products.totalCount,
            pending: orders.totalCount,
            shipped: shipped.totalCount,
            lowStock: stock.totalCount,
            recent: recent.items,
          })
          setUpdatedAt(new Date())
          setLoading(false)
        }
      })
      .catch((failure) => {
        if (controller.signal.aborted) return
        if (failure instanceof AuthError && failure.status === 401) auth.expire()
        setError('Chưa tải được tổng quan cửa hàng. Vui lòng thử lại.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [attempt])
  if (auth.status === 'loading')
    return (
      <section className="account-page container" role="status">
        Đang kiểm tra phiên…
      </section>
    )
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.user.role !== 'Admin') return <Navigate to="/account" replace />
  async function logout() {
    setPending(true)
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } catch {
      setError('Chưa thể đăng xuất. Vui lòng thử lại.')
      setPending(false)
    }
  }
  const cards: {
    title: string
    value: number | undefined
    note: string
    url: string
    icon: AdminIconName
  }[] = [
    {
      title: 'Tổng sản phẩm',
      value: data?.products,
      note: 'Sản phẩm trong danh mục quản trị',
      url: '/admin/products',
      icon: 'products',
    },
    {
      title: 'Chờ xác nhận',
      value: data?.pending,
      note: 'Đơn hàng cần bạn xử lý',
      url: '/admin/orders?status=pending',
      icon: 'clock',
    },
    {
      title: 'Đang giao hàng',
      value: data?.shipped,
      note: 'Đơn đã bàn giao vận chuyển',
      url: '/admin/orders?status=shipped',
      icon: 'truck',
    },
    {
      title: 'Kho cần chú ý',
      value: data?.lowStock,
      note: 'SKU chạm ngưỡng cảnh báo tồn',
      url: '/admin/inventory',
      icon: 'inventory',
    },
  ]
  return (
    <section className="admin-dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">ĐIỀU HÀNH CỬA HÀNG</p>
          <h1>Tổng quan cửa hàng</h1>
          <p className="dashboard-description">
            Theo dõi đơn hàng, sản phẩm và tình trạng kho ở một nơi.
          </p>
        </div>
        <div className="dashboard-heading-actions">
          <button disabled={loading} onClick={() => setAttempt((v) => v + 1)}>
            <AdminIcon name="refresh" />
            Làm mới
          </button>
          <button className="logout-button" onClick={logout} disabled={pending}>
            <AdminIcon name="logout" />
            {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      </div>
      {error && (
        <div className="dashboard-error" role="alert">
          {error}
          <button onClick={() => setAttempt((v) => v + 1)}>Thử lại</button>
        </div>
      )}
      <div className="dashboard-context">
        <span>
          <AdminIcon name="clock" />
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          })}
        </span>
        <span>
          {loading
            ? 'Đang cập nhật…'
            : error
              ? 'Cập nhật chưa thành công'
              : updatedAt
                ? 'Cập nhật lúc ' +
                  updatedAt.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })
                : ''}
        </span>
      </div>
      <div className="dashboard-metrics" aria-busy={loading}>
        {cards.map((card) => (
          <Link to={card.url} className="dashboard-metric" key={card.title}>
            <div>
              <span>{card.title}</span>
              <i>
                <AdminIcon name={card.icon} />
              </i>
            </div>
            <strong>{loading ? '…' : error ? '—' : card.value?.toLocaleString('vi-VN')}</strong>
            <p>{card.note}</p>
          </Link>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <h2>Đơn hàng gần đây</h2>
              <p>6 đơn mới nhất của cửa hàng</p>
            </div>
            <Link to="/admin/orders">
              Xem tất cả <AdminIcon name="arrow" />
            </Link>
          </div>
          {loading ? (
            <p className="dashboard-empty" role="status">
              Đang tải đơn hàng…
            </p>
          ) : error ? (
            <p className="dashboard-empty">Chưa có dữ liệu để hiển thị.</p>
          ) : data?.recent.length ? (
            <div className="dashboard-order-table">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Trạng thái</th>
                    <th className="dashboard-number">Tổng tiền</th>
                    <th>Ngày đặt</th>
                    <th>
                      <span className="sr-only">Chi tiết</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link to={'/admin/orders/' + order.id}>{order.reference}</Link>
                      </td>
                      <td>
                        <span className={'dashboard-status status-' + order.status}>
                          {orderLabels[order.status] || order.status}
                        </span>
                      </td>
                      <td className="dashboard-number">{money(order.grandTotalVnd)}</td>
                      <td>
                        {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </td>
                      <td>
                        <Link
                          className="dashboard-row-link"
                          to={'/admin/orders/' + order.id}
                          aria-label={'Xem đơn ' + order.reference}
                        >
                          <AdminIcon name="arrow" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-empty">
              <span className="dashboard-empty-icon">
                <AdminIcon name="orders" />
              </span>
              <h3>Chưa có đơn hàng</h3>
              <p>Đơn đặt từ cửa hàng sẽ xuất hiện tại đây.</p>
              <Link to="/admin/orders">Quản lý đơn hàng</Link>
            </div>
          )}
        </section>
        <aside className="dashboard-operations">
          <section className="dashboard-panel dashboard-tasks">
            <div className="dashboard-panel-heading">
              <div>
                <h2>Cần xử lý</h2>
                <p>Ưu tiên công việc đang chờ</p>
              </div>
              <span className="dashboard-panel-icon">
                <AdminIcon name="orders" />
              </span>
            </div>
            <Link to="/admin/orders?status=pending">
              <span className="dashboard-task-icon">
                <AdminIcon name="clock" />
              </span>
              <div>
                <strong>Xác nhận đơn hàng</strong>
                <small>
                  {loading
                    ? 'Đang tải…'
                    : error
                      ? 'Chưa tải được dữ liệu'
                      : data?.pending
                        ? `${data.pending} đơn đang chờ xác nhận`
                        : 'Không có đơn chờ xác nhận'}
                </small>
              </div>
              <AdminIcon name="arrow" />
            </Link>
            <Link to="/admin/inventory">
              <span className="dashboard-task-icon stock">
                <AdminIcon name="inventory" />
              </span>
              <div>
                <strong>Kiểm tra tồn kho</strong>
                <small>
                  {loading
                    ? 'Đang tải…'
                    : error
                      ? 'Chưa tải được dữ liệu'
                      : data?.lowStock
                        ? `${data.lowStock} SKU chạm ngưỡng cảnh báo`
                        : 'Không có cảnh báo tồn kho'}
                </small>
              </div>
              <AdminIcon name="arrow" />
            </Link>
            {!loading && !error && data?.pending === 0 && data?.lowStock === 0 && (
              <p className="dashboard-all-clear">
                <AdminIcon name="check" />
                Các hạng mục cần chú ý đã được xử lý.
              </p>
            )}
          </section>
          <section className="dashboard-panel dashboard-shortcuts">
            <div className="dashboard-panel-heading">
              <div>
                <h2>Truy cập nhanh</h2>
              </div>
            </div>
            <Link to="/admin/reports">
              <AdminIcon name="reports" />
              <span>Báo cáo bán hàng</span>
              <AdminIcon name="arrow" />
            </Link>
            <Link to="/admin/products">
              <AdminIcon name="products" />
              <span>Quản lý sản phẩm</span>
              <AdminIcon name="arrow" />
            </Link>
            <Link to="/admin/inventory">
              <AdminIcon name="inventory" />
              <span>Nhập và điều chỉnh kho</span>
              <AdminIcon name="arrow" />
            </Link>
            <Link to="/admin/orders">
              <AdminIcon name="orders" />
              <span>Tất cả đơn hàng</span>
              <AdminIcon name="arrow" />
            </Link>
          </section>
        </aside>
      </div>
      <footer className="dashboard-footer">
        <span>Nàng Gốm · Quản trị cửa hàng</span>
        <Link to="/">
          Mở trang bán hàng <AdminIcon name="external" />
        </Link>
      </footer>
    </section>
  )
}
