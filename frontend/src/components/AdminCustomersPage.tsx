import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { catalogRequest, type PageResult } from '../catalog/api'
import { AuthError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { reportMoney } from '../features/reports/api'
import AdminIcon from './AdminIcon'

type Customer = {
  id: string
  name: string
  email: string
  orderCount: number
  completedOrders: number
  completedSalesVnd: string
  lastOrderAt: string | null
}
export default function AdminCustomersPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<PageResult<Customer> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const signature = params.toString()
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    const timer = window.setTimeout(() => {
      catalogRequest<PageResult<Customer>>('admin/customers?' + signature, {
        signal: controller.signal,
      })
        .then((value) => {
          if (!controller.signal.aborted) setData(value)
        })
        .catch((failure) => {
          if (controller.signal.aborted) return
          if (failure instanceof AuthError && failure.status === 401) auth.expire()
          setError(failure instanceof Error ? failure.message : 'Chưa tải được khách hàng.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 200)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [signature, attempt])
  function search(value: string) {
    setParams(value ? { q: value } : {}, { replace: true })
  }
  const page = data?.page || 1
  function move(next: number) {
    const values = new URLSearchParams(params)
    values.set('page', String(next))
    setParams(values)
  }
  return (
    <section className="admin-customers-page container">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">NÀNG GỐM / KHÁCH HÀNG</p>
          <h1>Khách hàng</h1>
          <p className="admin-page-description">
            Theo dõi hồ sơ và lịch sử mua của khách đã đăng ký tài khoản.
          </p>
        </div>
        <button
          className="text-link"
          disabled={loading}
          onClick={() => setAttempt((value) => value + 1)}
        >
          <AdminIcon name="refresh" />
          Làm mới danh sách
        </button>
      </div>
      <div className="admin-customer-search">
        <label>
          Tìm khách hàng
          <input
            type="search"
            aria-label="Tìm khách hàng"
            value={params.get('q') || ''}
            maxLength={120}
            placeholder="Tên hoặc email…"
            onChange={(e) => search(e.target.value)}
          />
        </label>
        <span role="status">
          {loading
            ? 'Đang tải khách hàng…'
            : data
              ? data.totalCount.toLocaleString('vi-VN') + ' kết quả'
              : ''}
        </span>
        {params.get('q') && (
          <button className="text-link" onClick={() => search('')}>
            Xóa tìm kiếm
          </button>
        )}
      </div>
      {error && (
        <div className="dashboard-error" role="alert">
          {error}
          <button onClick={() => setAttempt((value) => value + 1)}>Thử lại khách hàng</button>
        </div>
      )}
      {!loading && data && (
        <>
          <div className="admin-table-viewport">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Đơn đặt</th>
                  <th>Hoàn tất</th>
                  <th>Giá trị đã mua</th>
                  <th>Lần đặt gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="admin-customer-identity">
                        <span>{customer.name.slice(0, 1).toLocaleUpperCase('vi')}</span>
                        <div>
                          <strong>{customer.name}</strong>
                          <small>{customer.email || 'Chưa có email'}</small>
                        </div>
                      </div>
                    </td>
                    <td>{customer.orderCount}</td>
                    <td>{customer.completedOrders}</td>
                    <td>{reportMoney(customer.completedSalesVnd)}</td>
                    <td>
                      {customer.lastOrderAt
                        ? new Date(customer.lastOrderAt).toLocaleDateString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          })
                        : 'Chưa có đơn'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <div className="dashboard-empty">
                <h2>Chưa tìm thấy khách hàng</h2>
                <p>Thử từ khóa khác hoặc xóa tìm kiếm.</p>
              </div>
            )}
          </div>
          <div className="catalog-pagination">
            <button disabled={page <= 1} onClick={() => move(page - 1)}>
              Trang trước
            </button>
            <span>
              Trang {page} · {data.totalCount} khách hàng
            </span>
            <button
              disabled={page * data.pageSize >= data.totalCount}
              onClick={() => move(page + 1)}
            >
              Trang sau
            </button>
          </div>
          <p className="admin-customer-note">
            Giá trị đã mua gồm tiền hàng và phí giao hàng của các đơn hoàn tất. Đơn khách vãng lai
            không nằm trong danh sách tài khoản này.
          </p>
        </>
      )}
    </section>
  )
}
