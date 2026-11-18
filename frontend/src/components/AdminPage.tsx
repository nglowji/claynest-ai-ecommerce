import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import { catalogRequest, type PageResult } from '../catalog/api'
import { listOrders, orderLabels, type OrderRow } from '../features/orders/adminApi'
import { money } from '../data/products'

type Summary = { products: number; pending: number; shipped: number; lowStock: number; recent: OrderRow[] }
export default function AdminPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const params = (status?: string) => new URLSearchParams({ page: '1', pageSize: '6', ...(status ? { status } : {}) })
    Promise.all([
      catalogRequest<PageResult<unknown>>('admin/catalog/products?page=1&pageSize=1', { signal: controller.signal }),
      listOrders(params('pending'), controller.signal), listOrders(params('shipped'), controller.signal),
      catalogRequest<PageResult<unknown>>('admin/inventory/?lowOnly=true&page=1&pageSize=1', { signal: controller.signal }),
      listOrders(params(), controller.signal),
    ]).then(([products, orders, shipped, stock, recent]) => {
      if (!controller.signal.aborted) { setData({ products: products.totalCount, pending: orders.totalCount, shipped: shipped.totalCount, lowStock: stock.totalCount, recent: recent.items }); setLoading(false) }
    }).catch(failure => {
      if (controller.signal.aborted) return
      if (failure instanceof AuthError && failure.status === 401) auth.expire()
      setError('Chưa tải được tổng quan cửa hàng. Vui lòng thử lại.'); setLoading(false)
    })
    return () => controller.abort()
  }, [attempt])
  if (auth.status === 'loading') return <section className="account-page container" role="status">Đang kiểm tra phiên…</section>
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.user.role !== 'Admin') return <Navigate to="/account" replace />
  async function logout() {
    setPending(true)
    try { await auth.logout(); navigate('/login', { replace: true }) }
    catch { setError('Chưa thể đăng xuất. Vui lòng thử lại.'); setPending(false) }
  }
  const cards = [
    { title: 'Tổng sản phẩm', value: data?.products, note: 'Sản phẩm trong danh mục quản trị', url: '/admin/products', symbol: '◇' },
    { title: 'Chờ xác nhận', value: data?.pending, note: 'Đơn hàng cần bạn xử lý', url: '/admin/orders?status=pending', symbol: '↗' },
    { title: 'Đang giao hàng', value: data?.shipped, note: 'Đơn đã bàn giao vận chuyển', url: '/admin/orders?status=shipped', symbol: '→' },
    { title: 'Kho cần chú ý', value: data?.lowStock, note: 'SKU chạm ngưỡng cảnh báo tồn', url: '/admin/inventory', symbol: '▤' },
  ]
  return <section className="admin-dashboard"><div className="dashboard-heading"><div><p className="eyebrow">TỔNG QUAN CỬA HÀNG</p><h1>Chào {auth.user.displayName || 'bạn'},<br /><em>hôm nay nhà Nàng thế nào?</em></h1></div><div className="dashboard-heading-actions"><button disabled={loading} onClick={() => setAttempt(v => v + 1)}>Làm mới</button><button className="logout-button" onClick={logout} disabled={pending}>{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}</button></div></div>
    {error && <div className="dashboard-error" role="alert">{error}<button onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>}
    <div className="dashboard-metrics" aria-busy={loading}>{cards.map(card => <Link to={card.url} className="dashboard-metric" key={card.title}><div><span>{card.title}</span><i aria-hidden="true">{card.symbol}</i></div><strong>{loading ? '…' : error ? '—' : card.value?.toLocaleString('vi-VN')}</strong><p>{card.note}</p></Link>)}</div>
    <div className="dashboard-columns"><section className="dashboard-panel"><div className="dashboard-panel-heading"><div><h2>Những đơn hàng gần đây</h2><p>Theo thời điểm đặt hàng mới nhất</p></div><Link to="/admin/orders">Xem tất cả ↗</Link></div>{loading ? <p className="dashboard-empty" role="status">Đang tải đơn hàng…</p> : error ? <p className="dashboard-empty">Chưa có dữ liệu để hiển thị.</p> : data?.recent.length ? <div className="dashboard-order-table"><table><thead><tr><th>Mã đơn</th><th>Trạng thái</th><th>Tổng tiền</th><th>Ngày đặt</th></tr></thead><tbody>{data.recent.map(order => <tr key={order.id}><td><Link to={'/admin/orders/' + order.id}>{order.reference}</Link></td><td><span className={'dashboard-status status-' + order.status}>{orderLabels[order.status] || order.status}</span></td><td>{money(order.grandTotalVnd)}</td><td>{new Date(order.createdAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td></tr>)}</tbody></table></div> : <div className="dashboard-empty"><span aria-hidden="true">▧</span><h3>Chưa có đơn hàng</h3><p>Đơn đặt từ cửa hàng sẽ xuất hiện tại đây.</p><Link to="/admin/orders">Đến quản lý đơn hàng ↗</Link></div>}</section>
    <section className="dashboard-panel dashboard-quick"><div className="dashboard-panel-heading"><div><h2>Công việc tại nhà Nàng</h2><p>Mọi thứ bạn cần, trong một góc nhỏ.</p></div></div><Link to="/admin/products"><span>01</span><div><strong>Chăm chút sản phẩm</strong><small>Tạo, chỉnh sửa và xuất bản sản phẩm</small></div><b>↗</b></Link><Link to="/admin/inventory"><span>02</span><div><strong>Kiểm tra kho gốm</strong><small>Nhập kho và theo dõi từng SKU</small></div><b>↗</b></Link><Link to="/admin/orders"><span>03</span><div><strong>Chuẩn bị những đơn mới</strong><small>Xác nhận, đóng gói và giao hàng</small></div><b>↗</b></Link><div className="dashboard-store-note"><p>Chỉn chu từ một chiếc cốc,<br />đến từng đơn hàng.</p><Link to="/">Xem cửa hàng ↗</Link></div></section></div>
    <p className="dashboard-session">Phiên quản trị đã được xác thực bởi máy chủ.</p>
  </section>
}
