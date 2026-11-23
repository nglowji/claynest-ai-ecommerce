import AdminActionButton from './AdminActionButton'
import { useSearchParams } from 'react-router-dom'
import SiteImage from './SiteImage'
import { useEffect, useRef, useState } from 'react'
import { catalogRequest, type PageResult } from '../catalog/api'
import { AuthError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import Icon from './Icon'

type StockItem = {
  variantId: string
  productId: string
  productName: string
  variantName: string
  sku: string
  stockQty: number
  lowStockThreshold: number
  revision: string
  active: boolean
  image: string
}
type Movement = {
  id: string
  kind: string
  quantityDelta: number
  balanceAfter: number
  thresholdAfter: number
  reason: string
  actorName: string
  createdAt: string
}
const kindNames: Record<string, string> = {
  restock: 'Hoàn kho khi hủy',
  sale: 'Đặt hàng',
  opening: 'Số dư đầu kỳ',
  receipt: 'Nhập kho',
  adjustment: 'Điều chỉnh',
  threshold: 'Đổi ngưỡng cảnh báo',
}
export default function AdminInventoryPage() {
  const auth = useAuth()
  const editor = useRef<HTMLElement>(null)
  const [params] = useSearchParams()
  const queryParam = params.get('q') || ''
  const lowParam = params.get('lowOnly') === 'true'
  const [query, setQuery] = useState(queryParam)
  const [lowOnly, setLowOnly] = useState(lowParam)
  const [page, setPage] = useState(1)
  useEffect(() => {
    setQuery(queryParam)
    setLowOnly(lowParam)
    setPage(1)
  }, [queryParam, lowParam])
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<PageResult<StockItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<StockItem | null>(null)
  useEffect(() => {
    if (selected && window.matchMedia('(max-width: 1300px)').matches) {
      editor.current?.scrollIntoView({ block: 'start' })
      editor.current?.focus({ preventScroll: true })
    }
  }, [selected?.variantId])
  const [kind, setKind] = useState('receipt')
  const [delta, setDelta] = useState('1')
  const [threshold, setThreshold] = useState('5')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [history, setHistory] = useState<PageResult<Movement> | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [historyAttempt, setHistoryAttempt] = useState(0)
  function failure(e: unknown) {
    if (e instanceof AuthError && e.status === 401) auth.expire()
    return e instanceof Error ? e.message : 'Chưa kết nối được kho. Vui lòng thử lại.'
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const timer = window.setTimeout(() => {
      catalogRequest<PageResult<StockItem>>(
        'admin/inventory/?' +
          new URLSearchParams({ q: query, lowOnly: String(lowOnly), page: String(page) }),
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted) {
            setData(result)
            setLoading(false)
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(failure(e))
            setLoading(false)
          }
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, lowOnly, page, attempt])
  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    setHistory(null)
    setHistoryError('')
    catalogRequest<PageResult<Movement>>(
      `admin/inventory/${selected.variantId}/movements?page=${historyPage}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setHistory(result)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setHistoryError(failure(e))
      })
    return () => controller.abort()
  }, [selected?.variantId, selected?.revision, historyPage, historyAttempt])
  useEffect(() => {
    if (selected && window.innerWidth <= 900)
      document
        .getElementById('stock-editor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected?.variantId])
  function choose(item: StockItem) {
    setSelected(item)
    setHistoryPage(1)
    setKind('receipt')
    setDelta('1')
    setThreshold(String(item.lowStockThreshold))
    setReason('')
    setSaveError('')
    setNotice('')
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || pending) return
    setPending(true)
    setSaveError('')
    setNotice('')
    try {
      const result = await catalogRequest<{ item: StockItem }>(
        `admin/inventory/${selected.variantId}/movements`,
        {
          method: 'POST',
          body: JSON.stringify({
            kind,
            quantityDelta: kind === 'threshold' ? 0 : Number(delta),
            lowStockThreshold: Number(threshold),
            reason,
            revision: selected.revision,
          }),
        },
      )
      setSelected(result.item)
      setReason('')
      setHistoryPage(1)
      setAttempt((n) => n + 1)
      setNotice('Đã cập nhật tồn kho và ghi lịch sử.')
    } catch (e) {
      setSaveError(failure(e))
      if (e instanceof AuthError && e.status === 409) {
        setAttempt((n) => n + 1)
        try {
          const latest = await catalogRequest<PageResult<StockItem>>(
            'admin/inventory/?' + new URLSearchParams({ q: selected.sku }),
          )
          const item = latest.items.find((v) => v.variantId === selected.variantId)
          if (item) {
            setSelected(item)
            setThreshold(String(item.lowStockThreshold))
          }
        } catch {
          /* Keep the stale revision: the server continues to reject stale writes. */
        }
      }
    } finally {
      setPending(false)
    }
  }
  return (
    <section className="inventory-page container">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">NÀNG GỐM / QUẢN LÝ KHO</p>
          <h1>Quản lý tồn kho</h1>
          <p className="admin-page-description">
            Theo dõi số lượng, nhập hàng và kiểm tra lịch sử biến động theo SKU.
          </p>
        </div>
        <button
          className="text-link"
          disabled={loading || pending}
          onClick={() => {
            setAttempt((n) => n + 1)
            setHistoryAttempt((n) => n + 1)
          }}
        >
          Tải lại dữ liệu <Icon name="arrow" />
        </button>
      </div>
      <div className="inventory-filters">
        <label>
          Tìm sản phẩm hoặc SKU
          <input
            value={query}
            maxLength={180}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Tên sản phẩm, mã SKU…"
          />
        </label>
        <label className="inventory-check">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              setLowOnly(e.target.checked)
              setPage(1)
            }}
          />{' '}
          Chỉ xem sắp hết hàng
        </label>
        <span role="status">{loading ? 'Đang tải…' : `${data?.totalCount || 0} biến thể`}</span>
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error} <button onClick={() => setAttempt((n) => n + 1)}>Thử lại</button>
        </p>
      )}
      <div className="inventory-layout">
        <div className="inventory-list">
          <div className="inventory-table-scroll">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th scope="col">Sản phẩm / SKU</th>
                  <th scope="col">Tồn kho</th>
                  <th scope="col">Ngưỡng thấp</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  !error &&
                  data?.items.map((item) => (
                    <tr
                      key={item.variantId}
                      className={selected?.variantId === item.variantId ? 'inventory-selected' : ''}
                    >
                      <td>
                        <div className="inventory-product">
                          {item.image && <SiteImage src={item.image} alt="" />}
                          <div>
                            <strong>{item.productName}</strong>
                            <small>
                              {item.sku} · {item.variantName}
                            </small>
                            {!item.active && <small>Ngừng bán</small>}
                          </div>
                        </div>
                      </td>
                      <td data-label="Tồn kho">
                        <span
                          className={
                            item.stockQty <= item.lowStockThreshold
                              ? 'stock-pill low'
                              : 'stock-pill'
                          }
                        >
                          {item.stockQty}
                        </span>
                      </td>
                      <td data-label="Ngưỡng thấp">{item.lowStockThreshold}</td>
                      <td>
                        <AdminActionButton
                          icon="edit"
                          label="Quản lý"
                          disabled={pending}
                          onClick={() => choose(item)}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!loading && !error && data?.totalCount === 0 && (
            <p className="empty-state">Không có biến thể phù hợp bộ lọc.</p>
          )}
          <div className="catalog-pagination">
            <button disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
              Trước
            </button>
            <span>Trang {page}</span>
            <button
              disabled={loading || !data || page * data.pageSize >= data.totalCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </button>
          </div>
        </div>
        <aside
          ref={editor}
          tabIndex={-1}
          className={selected ? 'inventory-editor has-selection' : 'inventory-editor'}
          id="stock-editor"
        >
          {selected ? (
            <>
              <p className="eyebrow">{selected.sku}</p>
              <h2>{selected.productName}</h2>
              <p className="inventory-balance">
                Tồn hiện tại <strong>{selected.stockQty}</strong>
              </p>
              <form onSubmit={save}>
                <fieldset disabled={pending}>
                  <label>
                    Thao tác
                    <select
                      aria-label="Thao tác"
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value)
                        setDelta('1')
                      }}
                    >
                      <option value="receipt">Nhập kho</option>
                      <option value="adjustment">Điều chỉnh tăng / giảm</option>
                      <option value="threshold">Đổi ngưỡng cảnh báo</option>
                    </select>
                  </label>
                  {kind !== 'threshold' && (
                    <label>
                      {kind === 'receipt' ? 'Số lượng nhập' : 'Số lượng thay đổi (âm để giảm)'}
                      <input
                        type="number"
                        required
                        min={kind === 'receipt' ? 1 : -1000000}
                        max="1000000"
                        step="1"
                        value={delta}
                        onChange={(e) => setDelta(e.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    Ngưỡng cảnh báo tồn thấp
                    <input
                      type="number"
                      required
                      min="0"
                      max="1000000"
                      step="1"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                  </label>
                  <label>
                    Lý do
                    <textarea
                      aria-label="Lý do"
                      required
                      minLength={3}
                      maxLength={500}
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Nhập hàng, kiểm kê, hư hỏng…"
                    />
                  </label>
                  <button className="button primary" type="submit">
                    {pending ? 'Đang lưu…' : 'Lưu thay đổi kho'}
                  </button>
                </fieldset>
              </form>
              {saveError && (
                <p className="auth-error" role="alert">
                  {saveError}
                </p>
              )}
              {notice && (
                <p className="inventory-success" role="status">
                  {notice}
                </p>
              )}
              <div className="inventory-history">
                <h3>Lịch sử kho</h3>
                {historyError ? (
                  <p role="alert">
                    {historyError}{' '}
                    <button onClick={() => setHistoryAttempt((n) => n + 1)}>Thử lại</button>
                  </p>
                ) : !history ? (
                  <p role="status">Đang tải lịch sử…</p>
                ) : (
                  <>
                    <ol>
                      {history.items.map((m) => (
                        <li key={m.id}>
                          <div>
                            <strong>{kindNames[m.kind] || m.kind}</strong>
                            <span>
                              {m.quantityDelta > 0 ? '+' : ''}
                              {m.quantityDelta} · Tồn {m.balanceAfter}
                            </span>
                          </div>
                          <p>{m.reason}</p>
                          <small>
                            {m.actorName} · {new Date(m.createdAt).toLocaleString('vi-VN')}
                          </small>
                          {m.kind === 'threshold' && <small>Ngưỡng: {m.thresholdAfter}</small>}
                        </li>
                      ))}
                    </ol>
                    {history.totalCount === 0 && <p>Chưa có thay đổi kho.</p>}
                    <div className="catalog-pagination">
                      <button
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage((p) => p - 1)}
                      >
                        Trước
                      </button>
                      <span>{historyPage}</span>
                      <button
                        disabled={historyPage * history.pageSize >= history.totalCount}
                        onClick={() => setHistoryPage((p) => p + 1)}
                      >
                        Sau
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="inventory-placeholder">
              <Icon name="bag" />
              <h2>Chọn một món gốm</h2>
              <p>Nhập kho, điều chỉnh số lượng và xem lịch sử tại đây.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
