import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import { money } from '../data/products'
import {
  getPurchases,
  purchaseDate,
  purchaseLabels,
  type PurchaseHistory,
  type PurchaseItem,
} from '../features/checkout/purchases'
import AdminPagination from './AdminPagination'
import SessionUnavailable from './SessionUnavailable'
import SiteImage from './SiteImage'
export default function CustomerOrdersPage({
  onReorder,
}: {
  onReorder: (items: PurchaseItem[]) => void
}) {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const signature = params.toString()
  const [data, setData] = useState<PurchaseHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => {
    if (!auth.user || auth.status !== 'authenticated' || auth.user.role === 'Admin') return
    const abort = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    const timer = window.setTimeout(() => {
      getPurchases(new URLSearchParams(signature), abort.signal)
        .then((value) => {
          if (!abort.signal.aborted) {
            setData(value)
            setLoading(false)
          }
        })
        .catch((failure) => {
          if (!abort.signal.aborted) {
            if (failure instanceof AuthError && failure.status === 401) auth.expire()
            setError(failure instanceof Error ? failure.message : 'Chưa tải được đơn hàng.')
            setLoading(false)
          }
        })
    }, 200)
    return () => {
      abort.abort()
      clearTimeout(timer)
    }
  }, [signature, attempt, auth.user?.id, auth.status])
  if (auth.status === 'loading')
    return (
      <section className="container account-page" role="status">
        Đang kiểm tra tài khoản…
      </section>
    )
  if (auth.status === 'unavailable') return <SessionUnavailable />
  if (!auth.user) return <Navigate to="/login?next=%2Faccount%2Forders" replace />
  if (auth.user.role === 'Admin') return <Navigate to="/admin" replace />
  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
    setExpanded(null)
  }
  return (
    <section className="purchases-page container">
      <nav className="breadcrumbs" aria-label="Đường dẫn">
        <Link to="/account">Tài khoản</Link>
        <span>/</span>
        <span>Đơn hàng đã mua</span>
      </nav>
      <header className="commerce-heading">
        <div>
          <p className="eyebrow">GÓC NHỎ CỦA BẠN</p>
          <h1>Đơn hàng của bạn</h1>
          <p>Theo dõi những món gốm đã chọn, từ lúc đặt đến khi về nhà.</p>
        </div>
        <div>
          <Link to="/orders">Tra cứu bằng mã riêng</Link>
          <button onClick={() => setAttempt((v) => v + 1)} disabled={loading}>
            Làm mới đơn hàng
          </button>
        </div>
      </header>
      <div className="purchase-filters">
        <label>
          Tìm mã đơn
          <input
            aria-label="Tìm mã đơn đã mua"
            type="search"
            maxLength={32}
            value={params.get('q') || ''}
            onChange={(e) => update('q', e.target.value)}
            placeholder="NG-…"
          />
        </label>
        <label>
          Trạng thái
          <select
            aria-label="Lọc trạng thái đơn đã mua"
            value={params.get('status') || ''}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(purchaseLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {(params.get('q') || params.get('status')) && (
          <button onClick={() => setParams({})}>Xóa bộ lọc</button>
        )}
      </div>
      {data && (
        <p className="purchase-result" role="status">
          {data.orders.totalCount} đơn phù hợp · {data.counts.reduce((n, row) => n + row.count, 0)}{' '}
          đơn trong tài khoản
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải đơn đã mua…</p>
      ) : error ? (
        <div className="auth-error" role="alert">
          {error} <button onClick={() => setAttempt((v) => v + 1)}>Thử lại đơn đã mua</button>
        </div>
      ) : (
        data && (
          <>
            <div className="purchase-cards">
              {data.orders.items.map((order) => (
                <article className="purchase-card" key={order.reference}>
                  <header>
                    <div>
                      <Link to={'/orders/' + order.reference}>{order.reference}</Link>
                      <time dateTime={order.createdAt}>{purchaseDate(order.createdAt)}</time>
                    </div>
                    <span className={'purchase-status ' + order.status}>
                      {purchaseLabels[order.status]}
                    </span>
                  </header>
                  <ul>
                    {order.items
                      .slice(0, expanded === order.reference ? undefined : 2)
                      .map((item) => (
                        <li key={item.variantId}>
                          {item.image && (
                            <SiteImage
                              src={item.image}
                              alt={item.name}
                              loading="lazy"
                              width={64}
                              height={64}
                            />
                          )}
                          <div>
                            {item.slug ? (
                              <Link to={'/products/' + item.slug + '?variant=' + item.variantId}>
                                {item.name}
                              </Link>
                            ) : (
                              <strong>{item.name}</strong>
                            )}
                            <span>
                              {item.variantName} · Số lượng {item.quantity}
                            </span>
                            {!item.slug && <small>Sản phẩm không còn được giới thiệu</small>}
                          </div>
                          <b>{money(item.lineTotalVnd)}</b>
                        </li>
                      ))}
                  </ul>
                  {order.items.length > 2 && (
                    <button
                      className="purchase-expand"
                      onClick={() =>
                        setExpanded(expanded === order.reference ? null : order.reference)
                      }
                    >
                      {expanded === order.reference
                        ? 'Thu gọn sản phẩm'
                        : `Xem thêm ${order.items.length - 2} sản phẩm`}
                    </button>
                  )}
                  <footer>
                    <div>
                      <small>
                        {order.status === 'cancelled'
                          ? 'Giá trị đơn đã hủy'
                          : order.paymentStatus === 'paid'
                            ? 'Đã thanh toán'
                            : order.paymentMethod === 'zalopay'
                              ? 'Chờ thanh toán ZaloPay'
                              : 'Thanh toán khi nhận hàng'}
                      </small>
                      <strong>{money(order.grandTotalVnd)}</strong>
                    </div>
                    <div>
                      <Link className="button secondary" to={'/orders/' + order.reference}>
                        Theo dõi đơn
                      </Link>
                      <button
                        className="button primary"
                        disabled={!order.items.some((i) => i.slug && i.availableQty > 0)}
                        onClick={() => onReorder(order.items)}
                      >
                        Mua lại
                      </button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
            {!data.orders.items.length && (
              <div className="purchase-empty">
                <h2>
                  {params.get('q') || params.get('status')
                    ? 'Chưa có đơn phù hợp'
                    : 'Chưa có đơn hàng trong tài khoản'}
                </h2>
                <p>
                  Đơn đã đặt khi đăng nhập sẽ được lưu tại đây. Đơn mua không đăng nhập có thể tra
                  cứu bằng mã riêng.
                </p>
                <Link className="button primary" to="/products">
                  Ghé chọn một món gốm
                </Link>
              </div>
            )}
            <AdminPagination
              page={data.orders.page}
              pageSize={5}
              totalCount={data.orders.totalCount}
              onPage={(value) => update('page', String(value))}
            />
            <p className="purchase-footnote">
              Mua lại sẽ thêm sản phẩm còn bán vào giỏ theo tồn hiện tại. Giá và phí giao hàng được
              kiểm tra lại trước khi đặt.
            </p>
          </>
        )
      )}
    </section>
  )
}
