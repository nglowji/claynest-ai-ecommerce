import AdminEditorDialog from './AdminEditorDialog'
import AdminTabs from './AdminTabs'
import InventorySummary from './InventorySummary'
import InventoryHistory, { type StockMovement } from './InventoryHistory'
import AdminPagination from './AdminPagination'
import AdminActionButton from './AdminActionButton'
import { useSearchParams } from 'react-router-dom'
import SiteImage from './SiteImage'
import { useEffect, useState } from 'react'
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
export default function AdminInventoryPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const lowOnly = params.get('lowOnly') === 'true'
  const rawPage = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }
  const setPage = (value: number) => filter('page', String(value))
  const [editorView, setEditorView] = useState('update')
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<PageResult<StockItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<StockItem | null>(null)
  const [kind, setKind] = useState('receipt')
  const [delta, setDelta] = useState('1')
  const [threshold, setThreshold] = useState('5')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [history, setHistory] = useState<PageResult<StockMovement> | null>(null)
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
          new URLSearchParams({
            q: query,
            lowOnly: String(lowOnly),
            page: String(page),
            pageSize: '10',
          }),
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
    catalogRequest<PageResult<StockMovement>>(
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
  function choose(item: StockItem) {
    setSelected(item)
    setEditorView('update')
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
    if (
      kind !== 'threshold' &&
      (!Number.isSafeInteger(Number(delta)) ||
        Number(delta) === 0 ||
        selected.stockQty + Number(delta) < 0)
    ) {
      setSaveError('Số lượng phải là số nguyên khác 0 và không thể trừ quá tồn kho.')
      return
    }
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
            Theo dõi số lượng, nhập hàng và kiểm tra lịch sử biến động theo mã sản phẩm (SKU).
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
      <InventorySummary
        revision={attempt}
        lowOnly={lowOnly}
        onFilter={(low) => filter('lowOnly', low ? 'true' : '')}
      />
      <div className="inventory-filters">
        <label>
          Tìm sản phẩm hoặc mã
          <input
            value={query}
            maxLength={180}
            onChange={(e) => {
              filter('q', e.target.value)
            }}
            placeholder="Tên sản phẩm, mã sản phẩm…"
          />
        </label>
        <label className="inventory-check">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => {
              filter('lowOnly', e.target.checked ? 'true' : '')
            }}
          />{' '}
          Chỉ xem sắp hết hàng
        </label>
        {(query || lowOnly) && (
          <button className="text-link" onClick={() => setParams({})}>
            Xóa bộ lọc kho
          </button>
        )}
        <span role="status">{loading ? 'Đang tải…' : `${data?.totalCount || 0} biến thể`}</span>
      </div>
      {error && (
        <p role="alert" className="auth-error">
          {error} <button onClick={() => setAttempt((n) => n + 1)}>Thử lại</button>
        </p>
      )}
      <div className="inventory-workspace">
        <div className="inventory-list">
          <div className="inventory-table-scroll">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th scope="col">Sản phẩm / Mã</th>
                  <th scope="col">Tồn kho</th>
                  <th scope="col">Ngưỡng thấp</th>
                  <th scope="col">Tình trạng</th>
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
                        <span
                          className={
                            'inventory-state ' +
                            (item.stockQty === 0
                              ? 'empty'
                              : item.stockQty <= item.lowStockThreshold
                                ? 'low'
                                : 'ready')
                          }
                        >
                          {item.stockQty === 0
                            ? 'Hết hàng'
                            : item.stockQty <= item.lowStockThreshold
                              ? 'Cần bổ sung'
                              : 'Đủ hàng'}
                        </span>
                      </td>
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
          <AdminPagination
            page={page}
            pageSize={data?.pageSize || 10}
            totalCount={data?.totalCount || 0}
            loading={loading}
            onPage={setPage}
          />
        </div>
        {selected && (
          <AdminEditorDialog
            titleId="stock-editor-title"
            className="inventory-dialog"
            busy={pending}
            error={saveError}
            notice={notice}
            onClose={() => setSelected(null)}
          >
            <div className="inventory-dialog-heading">
              <div>
                <p className="eyebrow">{selected.sku}</p>
                <h2 id="stock-editor-title">{selected.productName}</h2>
              </div>
              <button
                className="text-link"
                aria-label="Đóng quản lý kho"
                disabled={pending}
                onClick={() => setSelected(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="inventory-balance">
              Tồn hiện tại <strong>{selected.stockQty}</strong>
            </p>
            <AdminTabs
              id="stock-view"
              label="Thông tin kho"
              value={editorView}
              options={[
                { value: 'update', label: 'Cập nhật tồn' },
                { value: 'history', label: 'Lịch sử' },
              ]}
              onChange={setEditorView}
            />
            <div id="stock-view-panel" role="tabpanel" aria-labelledby={'stock-view-' + editorView}>
              {editorView === 'update' ? (
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
                    <div className="inventory-preview" aria-live="polite">
                      <span>Tồn sau thay đổi</span>
                      <strong>
                        {kind === 'threshold'
                          ? selected.stockQty
                          : Number.isSafeInteger(Number(delta))
                            ? selected.stockQty + Number(delta)
                            : '—'}
                      </strong>
                      <small>Ngưỡng cảnh báo: {threshold || '—'}</small>
                    </div>
                    <button className="button primary" type="submit">
                      {pending ? 'Đang lưu…' : 'Lưu thay đổi kho'}
                    </button>
                  </fieldset>
                </form>
              ) : (
                <InventoryHistory
                  history={history}
                  historyError={historyError}
                  historyPage={historyPage}
                  setHistoryPage={setHistoryPage}
                  retry={() => setHistoryAttempt((n) => n + 1)}
                />
              )}
            </div>
          </AdminEditorDialog>
        )}
      </div>
    </section>
  )
}
