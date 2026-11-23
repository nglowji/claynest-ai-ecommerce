import SiteImage from './SiteImage'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AuthError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import type { PageResult } from '../catalog/api'
import { money } from '../data/products'
import { actionLabels, getOrder, listOrders, orderLabels, transitionOrder, type AdminOrder, type OrderRow, type Transition } from '../features/orders/adminApi'
import Icon from './Icon'

const timestamp = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
function Badge({ status }: { status: string }) { return <span className={'fulfilment-badge ' + status}>{orderLabels[status] || status}</span> }

export default function AdminOrdersPage() {
  const auth = useAuth()
  const [params,setParams] = useSearchParams()
  const [data,setData] = useState<PageResult<OrderRow> | null>(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [attempt,setAttempt] = useState(0)
  const signature = params.toString()
  const page = data?.page || Number(params.get('page') || 1)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('')
    const timer = setTimeout(() => {
      listOrders(new URLSearchParams(signature),controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false) } })
        .catch(e => { if (!controller.signal.aborted) { if (e instanceof AuthError && e.status === 401) auth.expire(); setError(e instanceof Error ? e.message : 'Chưa tải được đơn hàng.'); setLoading(false) } })
    },200)
    return () => { clearTimeout(timer); controller.abort() }
  },[signature,attempt])
  function update(key: string,value: string) { const next = new URLSearchParams(params); value ? next.set(key,value) : next.delete(key); if (key !== 'page') next.delete('page'); setParams(next, { replace: key === 'q' }) }
  return <section className="admin-orders-page container"><div className="admin-heading"><div><p className="eyebrow">NÀNG GỐM / ĐƠN HÀNG</p><h1>Từ nhà Nàng,<br /><em>đến tay bạn.</em></h1></div><button className="text-link" disabled={loading} onClick={() => setAttempt(n => n + 1)}>Tải lại đơn hàng <Icon name="arrow" /></button></div>
    <div className="order-admin-filters"><label>Tìm mã đơn<input aria-label="Tìm mã đơn" value={params.get('q') || ''} maxLength={32} placeholder="NG-…" onChange={e => update('q',e.target.value)} /></label><label>Trạng thái<select aria-label="Lọc trạng thái đơn" value={params.get('status') || ''} onChange={e => update('status',e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(orderLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Từ ngày<input aria-label="Đơn đặt từ ngày" type="date" value={params.get('from') || ''} onChange={e => update('from',e.target.value)} /></label><label>Đến ngày<input aria-label="Đơn đặt đến ngày" type="date" value={params.get('to') || ''} onChange={e => update('to',e.target.value)} /></label><button className="order-filter-reset" onClick={() => setParams({})}>Xóa bộ lọc</button></div><div className="order-list-meta"><p>Ngày đặt tính theo giờ Việt Nam.</p><span role="status">{loading ? 'Đang tải đơn hàng…' : data ? `${data.totalCount} đơn hàng` : ''}</span></div>
    {error && <p className="auth-error" role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Thử lại</button></p>}
    {!loading && !error && data && <><table className="catalog-table admin-orders-table"><thead><tr><th scope="col">Mã đơn / Ngày đặt</th><th scope="col">Người nhận</th><th scope="col">Trạng thái</th><th scope="col">Tổng thanh toán</th><th scope="col">Thao tác</th></tr></thead><tbody>{data.items.map(order => <tr key={order.id}><td><Link className="order-reference-link" to={'/admin/orders/' + order.id}>{order.reference}</Link><small>{timestamp(order.createdAt)}</small></td><td><strong>{order.customerName}</strong><small>{order.province} · {order.itemCount} món</small></td><td><Badge status={order.status} /></td><td><strong>{money(order.grandTotalVnd)}</strong><small>{order.paymentStatus === 'paid' ? 'Đã thu COD' : 'Chưa thanh toán'}</small></td><td><Link className="text-link" to={'/admin/orders/' + order.id}>Xem đơn <Icon name="arrow" /></Link></td></tr>)}</tbody></table>{data.totalCount === 0 && <div className="empty-state"><Icon name="bag" /><h2>Chưa có đơn phù hợp</h2><p>Đơn khách đặt sẽ xuất hiện tại đây để Nàng xác nhận và chuẩn bị.</p></div>}<div className="catalog-pagination"><button disabled={page <= 1} onClick={() => update('page',String(page - 1))}>Trang trước</button><span>Trang {page}</span><button disabled={page * data.pageSize >= data.totalCount} onClick={() => update('page',String(page + 1))}>Trang sau</button></div></>}
  </section>
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams(); const auth = useAuth()
  const [data,setData] = useState<AdminOrder | null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [attempt,setAttempt] = useState(0)
  const [target,setTarget] = useState('')
  const [reason,setReason] = useState('')
  const [cod,setCod] = useState(false)
  const [cancelAcknowledged,setCancelAcknowledged] = useState(false)
  const [pending,setPending] = useState<Transition | null>(null)
  const [saving,setSaving] = useState(false)
  const busy = useRef(false)
  const [actionError,setActionError] = useState('')
  const [notice,setNotice] = useState('')
  function failure(e: unknown) { if (e instanceof AuthError && e.status === 401) auth.expire(); return e instanceof Error ? e.message : 'Chưa kết nối được đơn hàng.' }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('')
    getOrder(id,controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); setLoading(false) } })
      .catch(e => { if (!controller.signal.aborted) { setError(failure(e)); setLoading(false) } })
    return () => controller.abort()
  },[id,attempt])
  useEffect(() => { const next = data?.allowedTransitions[0] || ''; setTarget(next); setReason(next && next !== 'cancelled' ? actionLabels[next] : ''); setCod(false); setCancelAcknowledged(false) },[data?.id,data?.revision])
  function selectTarget(value: string) { setTarget(value); setReason(value === 'cancelled' ? '' : actionLabels[value]); setCod(false); setCancelAcknowledged(false); setActionError(''); setNotice('') }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!data || busy.current) return
    if (!pending && (target === 'completed' && !cod || target === 'cancelled' && !cancelAcknowledged)) return
    const command = pending || { status: target, revision: data.revision, reason, requestId: crypto.randomUUID(), confirmCodCollected: cod }
    busy.current = true; setSaving(true); setPending(command); setActionError(''); setNotice('')
    try {
      const updated = await transitionOrder(id,command); setData(updated); setPending(null)
      setNotice(command.status !== updated.status ? 'Thao tác đã được ghi nhận. Đơn đã có cập nhật tiếp theo; xem lịch sử bên dưới.' : updated.status === 'cancelled' ? 'Đã hủy đơn và hoàn kho đúng số lượng.' : 'Đã cập nhật trạng thái và ghi lịch sử.')
    } catch (e) {
      setActionError(failure(e))
      if (e instanceof AuthError && ['order_conflict','order_request_conflict','invalid_transition','invalid_order','invalid_stock'].includes(e.code || '')) { setPending(null); setAttempt(n => n + 1) }
    } finally { busy.current = false; setSaving(false) }
  }
  return <section className="admin-order-detail container"><Link className="text-link" to="/admin/orders">← Danh sách đơn hàng</Link>{loading && <p className="checkout-message" role="status">Đang tải chi tiết đơn…</p>}{error && <p className="auth-error" role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Thử lại</button></p>}
    {!loading && !error && data && <><div className="order-detail-heading"><div><p className="eyebrow">ĐƠN HÀNG / {timestamp(data.createdAt)}</p><h1>{data.reference}</h1></div><Badge status={data.status} /></div><div className="fulfilment-layout"><div className="fulfilment-main"><section className="fulfilment-panel"><h2>Thông tin người nhận</h2><div className="fulfilment-contact"><div><strong>{data.contact.name}</strong><p>{data.contact.phone}{data.contact.email && <><br />{data.contact.email}</>}</p></div><p>{data.contact.address}<br />{data.contact.province}</p></div>{data.contact.note && <p className="fulfilment-shipping-note">Ghi chú giao hàng: {data.contact.note}</p>}</section>
    <section className="fulfilment-panel"><h2>Món gốm trong đơn</h2><ul className="fulfilment-items">{data.items.map(item => <li key={item.sku}><SiteImage src={item.image} alt={item.productName} /><div><strong>{item.productName}</strong><small>{item.sku} · {item.variantName}</small><span>{item.quantity} × {money(item.unitPriceVnd)}</span></div><b>{money(item.lineTotalVnd)}</b></li>)}</ul><dl className="checkout-totals"><div><dt>Tiền sản phẩm</dt><dd>{money(data.subtotalVnd)}</dd></div><div><dt>Phí giao hàng</dt><dd>{money(data.shippingFeeVnd)}</dd></div><div className="checkout-grand"><dt>{data.status === 'cancelled' ? 'Giá trị đơn đã hủy' : 'Tổng COD'}</dt><dd>{money(data.grandTotalVnd)}</dd></div></dl><p className="fulfilment-payment">{data.status === 'cancelled' ? 'Đơn đã hủy · Không thu tiền COD.' : data.paymentStatus === 'paid' ? 'Đã ghi nhận thu đủ tiền COD.' : 'Chưa thanh toán · Thu tiền khi giao hàng.'}</p></section>
    <section className="fulfilment-panel"><h2>Lịch sử xử lý</h2><ol className="fulfilment-history">{data.history.map(change => <li key={change.id}><div><strong>{orderLabels[change.toStatus]}</strong><time dateTime={change.createdAt}>{timestamp(change.createdAt)}</time></div><p>{change.reason}</p><small>{change.actorName}</small></li>)}</ol></section></div>
    <aside className="fulfilment-actions"><h2>Xử lý đơn hàng</h2>{data.restockedAt && <p className="fulfilment-restocked">Đã hoàn kho · {timestamp(data.restockedAt)}</p>}{data.completedAt && <p className="fulfilment-restocked">Hoàn tất · {timestamp(data.completedAt)}</p>}
    {data.allowedTransitions.length || pending ? <form onSubmit={submit}><fieldset disabled={saving || !!pending}><label>Thao tác tiếp theo<select aria-label="Thao tác xử lý đơn" value={target} onChange={e => selectTarget(e.target.value)}>{data.allowedTransitions.map(status => <option key={status} value={status}>{actionLabels[status]}</option>)}</select></label><label>Lý do / ghi chú xử lý<textarea aria-label="Lý do xử lý đơn" required minLength={3} maxLength={500} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>{target === 'cancelled' && <><p className="fulfilment-cancel-note">Hủy đơn sẽ hoàn lại toàn bộ số lượng đã giữ vào kho. Đơn hủy không thể mở lại.</p><label className="fulfilment-checkbox"><input type="checkbox" required checked={cancelAcknowledged} onChange={e => setCancelAcknowledged(e.target.checked)} /> Tôi xác nhận hủy đơn và hoàn kho.</label></>}{target === 'completed' && <label className="fulfilment-checkbox"><input type="checkbox" required checked={cod} onChange={e => setCod(e.target.checked)} /> Đơn đã giao và đã thu đủ tiền COD.</label>}</fieldset>
    {pending && !saving && <p className="checkout-pending" role="status">Chưa xác nhận được kết quả. Kiểm tra lại bằng cùng mã thao tác để tránh xử lý lặp.</p>}
    <button className={'button primary' + (target === 'cancelled' ? ' cancel-order-button' : '')} disabled={saving || !pending && (target === 'completed' && !cod || target === 'cancelled' && !cancelAcknowledged)}>{saving ? 'Đang lưu…' : pending ? 'Kiểm tra lại thao tác' : actionLabels[target] || 'Lưu trạng thái'} <Icon name="arrow" /></button></form> : <p className="fulfilment-terminal">{data.status === 'cancelled' ? 'Đơn đã hủy. Số lượng đã được hoàn kho và lưu lịch sử.' : 'Đơn đã hoàn tất. Lịch sử và giá trị giao dịch được giữ nguyên.'}</p>}
    {actionError && <p className="auth-error" role="alert">{actionError}</p>}{notice && <p className="order-action-success" role="status">{notice}</p>}<button className="fulfilment-reload" disabled={saving || !!pending} onClick={() => setAttempt(n => n + 1)}>Tải lại chi tiết đơn</button></aside></div></>}
  </section>
}
