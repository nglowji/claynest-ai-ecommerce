import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import { listOrders, orderLabels, type OrderRow } from '../features/orders/adminApi'
import { money } from '../data/products'

type Props = { recent: OrderRow[]; loading: boolean; error: string; revision: string }
export default function DashboardOrders({ recent, loading, error, revision }: Props) {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const value = params.get('orderStatus') || ''
  const filter = ['pending', 'confirmed', 'packed', 'shipped'].includes(value) ? value : ''
  function setFilter(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('orderStatus', value)
    else next.delete('orderStatus')
    setParams(next)
  }
  const [rows, setRows] = useState<OrderRow[]>([])
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!filter) return
    const controller = new AbortController()
    setPending(true)
    setFailure('')
    setRows([])
    listOrders(new URLSearchParams({ status: filter, pageSize: '4', page: '1' }), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRows(data.items)
      })
      .catch((e) => {
        if (controller.signal.aborted) return
        if (e instanceof AuthError && e.status === 401) auth.expire()
        setFailure('Chưa tải được danh sách đơn. Vui lòng thử lại.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [filter, revision, attempt])
  const busy = filter ? pending : loading
  const problem = filter ? failure : error
  const orders = filter ? rows : recent.slice(0, 4)
  const filters = [
    { value: '', label: 'Mới nhất' },
    { value: 'pending', label: 'Chờ xác nhận' },
    { value: 'confirmed', label: 'Chờ đóng gói' },
    { value: 'packed', label: 'Chờ bàn giao' },
    { value: 'shipped', label: 'Đang giao' },
  ]
  return (
    <section
      className="dashboard-panel dashboard-orders-panel"
      aria-labelledby="dashboard-orders-title"
    >
      <div className="dashboard-panel-heading">
        <div>
          <h2 id="dashboard-orders-title">Đơn hàng gần đây</h2>
          <p>Theo dõi và xử lý đơn hàng của cửa hàng</p>
        </div>
        <Link to="/admin/orders">Quản lý đơn hàng</Link>
      </div>
      <div
        className="dashboard-order-filters"
        role="group"
        aria-label="Lọc đơn hàng trên tổng quan"
      >
        {filters.map((item) => (
          <button
            key={item.value}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {busy ? (
        <p className="dashboard-empty" role="status">
          Đang tải đơn hàng…
        </p>
      ) : problem ? (
        <div className="dashboard-empty" role="alert">
          <p>{problem}</p>
          {filter && <button onClick={() => setAttempt((n) => n + 1)}>Thử lại đơn hàng</button>}
        </div>
      ) : orders.length ? (
        <div className="dashboard-order-table">
          <table>
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Trạng thái</th>
                <th className="dashboard-number">Tổng tiền</th>
                <th>Ngày đặt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={'/admin/orders/' + order.id}>{order.reference}</Link>
                    <small>{order.itemCount} sản phẩm</small>
                  </td>
                  <td>
                    {order.customerName}
                    <small>{order.province}</small>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dashboard-empty">
          <h3>{filter ? 'Không có đơn ở trạng thái này' : 'Chưa có đơn hàng'}</h3>
          <p>Đơn đặt từ cửa hàng sẽ xuất hiện tại đây.</p>
        </div>
      )}
      <div className="dashboard-table-footer">
        <span>Hiển thị tối đa 4 đơn mới nhất</span>
        <Link to={'/admin/orders' + (filter ? '?status=' + filter : '')}>Xem danh sách đầy đủ</Link>
      </div>
    </section>
  )
}
