import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { lookupOrder, savedToken, type OrderStatus } from '../features/checkout/api'
import { money } from '../data/products'
import Icon from './Icon'
const labels: Record<string,string> = { pending: 'Đang chờ xác nhận', confirmed: 'Đã xác nhận', packed: 'Đã đóng gói', shipped: 'Đang giao hàng', completed: 'Đã hoàn tất', cancelled: 'Đã hủy' }
export default function OrderStatusPage() {
  const { reference } = useParams(); const location = useLocation(); const navigate = useNavigate()
  const [inputReference,setReference] = useState(reference || '')
  const [inputToken,setInputToken] = useState('')
  const [data,setData] = useState<OrderStatus | null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const [attempt,setAttempt] = useState(0)
  const [copyNotice,setCopyNotice] = useState('')
  async function copyAccess() { try { await navigator.clipboard.writeText(access); setCopyNotice('Đã sao chép mã truy cập.') } catch { setCopyNotice('Bạn có thể chọn mã phía trên và sao chép thủ công.') } }
  const access = (location.state as { accessToken?: string } | null)?.accessToken || (reference ? savedToken(reference) : '')
  useEffect(() => {
    setReference(reference || ''); setData(null); setError(''); if (!reference) return
    let active = true; setLoading(true)
    lookupOrder(reference,access).then(result => { if (active) { setData(result); setLoading(false) } }).catch(e => { if (active) { setError(e instanceof Error ? e.message : 'Chưa tra cứu được đơn.'); setLoading(false) } })
    return () => { active = false }
  }, [reference,access,location.key,attempt])
  function lookup(event: React.FormEvent) { event.preventDefault(); navigate('/orders/' + encodeURIComponent(inputReference.trim().toUpperCase()), { state: { accessToken: inputToken.trim() } }) }
  return <section className="order-page container" aria-labelledby="order-title"><div className="checkout-heading"><p className="eyebrow">NÀNG GỐM / ĐƠN HÀNG</p><h1 id="order-title">{data ? <>Cảm ơn bạn <em>đã chọn Nàng.</em></> : <>Một chút gốm,<br /><em>đang trên hành trình.</em></>}</h1><p>{data ? 'Đơn hàng đã được ghi nhận. Bạn có thể kiểm tra trạng thái tại đây.' : 'Nhập mã đơn và mã truy cập riêng được cấp khi đặt hàng.'}</p></div>
    {loading && <p role="status">Đang tải đơn hàng…</p>}{error && <div className="auth-error" role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Thử lại</button></div>}
    {!data && !loading && <form className="order-lookup" onSubmit={lookup}><label>Mã đơn hàng<input aria-label="Mã đơn hàng" required maxLength={32} value={inputReference} onChange={e => setReference(e.target.value)} placeholder="NG-…" autoComplete="off" /></label><label>Mã truy cập riêng<input aria-label="Mã truy cập riêng" type="password" maxLength={128} value={inputToken} onChange={e => setInputToken(e.target.value)} autoComplete="off" /></label><p>Nếu đã đăng nhập tài khoản đặt đơn, bạn chỉ cần mã đơn hàng.</p><button className="button primary">Tra cứu đơn hàng <Icon name="arrow" /></button></form>}
    {data && <><div className="order-status-banner"><div><span>Mã đơn hàng</span><strong>{data.reference}</strong><small>{new Date(data.createdAt).toLocaleString('vi-VN')}</small></div><span className="order-status-pill">{labels[data.status] || data.status}</span></div><div className="checkout-layout"><section className="order-info"><h2>Thông tin nhận hàng</h2><p><strong>{data.contact.name}</strong><br />{data.contact.phone}<br />{data.contact.address}<br />{data.contact.province}</p>{data.contact.note && <p>Ghi chú: {data.contact.note}</p>}<h2>Thanh toán</h2><p>Thanh toán khi nhận hàng (COD) · {data.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>{access && <details className="order-access"><summary>Mã truy cập riêng của đơn</summary><p>Giữ mã này để tra cứu từ thiết bị khác. Không chia sẻ công khai. Mã có hiệu lực 30 ngày kể từ lúc đặt hàng.</p><code>{access}</code><button onClick={copyAccess}>Sao chép mã truy cập</button>{copyNotice && <p role="status">{copyNotice}</p>}</details>}<Link className="text-link" to="/products">Tiếp tục chọn gốm <Icon name="arrow" /></Link></section><aside className="checkout-summary"><h2>Chi tiết đơn hàng</h2><ul>{data.items.map(item => <li key={item.sku}>{item.image && <img src={item.image} alt={item.productName} />}<div><strong>{item.productName}</strong><span>{item.variantName} · SL {item.quantity}</span><span>{money(item.unitPriceVnd)} / sản phẩm</span></div><b>{money(item.lineTotalVnd)}</b></li>)}</ul><dl className="checkout-totals"><div><dt>Tiền sản phẩm</dt><dd>{money(data.subtotalVnd)}</dd></div><div><dt>Phí giao hàng</dt><dd>{data.shippingFeeVnd ? money(data.shippingFeeVnd) : 'Miễn phí'}</dd></div><div className="checkout-grand"><dt>Tổng thanh toán</dt><dd>{money(data.grandTotalVnd)}</dd></div></dl></aside></div></>}
  </section>
}
