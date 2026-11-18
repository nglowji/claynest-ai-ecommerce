import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import { money } from '../data/products'
import type { Cart } from '../features/cart/useCart'
import { placeOrder, saveReceipt, type Checkout, type Contact } from '../features/checkout/api'
import { useQuote } from '../features/checkout/useQuote'
import Icon from './Icon'

type Attempt = { key: string; command: Checkout; cart: Cart }
const pendingKey = 'nang-gom-checkout-pending'
function restore(): Attempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey) || 'null')
    return value && value.cart && typeof value.cart === 'object' && typeof value.key === 'string' && typeof value.command?.quoteToken === 'string' && value.command?.acceptTerms === true
      && ['name','phone','email','province','address','note'].every(k => typeof value.command?.contact?.[k] === 'string') ? value : null
  } catch { return null }
}
export default function CheckoutPage({ quantities, onPlaced }: { quantities: Cart; onPlaced: (ordered: Cart) => void }) {
  const auth = useAuth(); const navigate = useNavigate(); const quote = useQuote(quantities)
  const [pending,setPending] = useState<Attempt | null>(restore)
  const [contact,setContact] = useState<Contact>(() => restore()?.command.contact || { name: auth.user?.displayName || '', email: auth.user?.email || '', phone: '', province: '', address: '', note: '' })
  const [accepted,setAccepted] = useState(false)
  const [submitting,setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [error,setError] = useState('')
  const [now,setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { setAccepted(false) }, [quote.data?.quoteToken])
  const expired = !!quote.data && Date.parse(quote.data.expiresAt) <= now
  const update = (key: keyof Contact, value: string) => setContact(current => ({ ...current, [key]: value }))
  function remember(value: Attempt | null) { setPending(value); try { value ? sessionStorage.setItem(pendingKey, JSON.stringify(value)) : sessionStorage.removeItem(pendingKey) } catch { /* The same in-memory attempt is reused while this tab remains open. */ } }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submittingRef.current) return
    if (!pending && (!accepted || !quote.data?.canCheckout || !quote.data.quoteToken || expired)) return
    const attempt = pending || { key: crypto.randomUUID(), command: { quoteToken: quote.data!.quoteToken!, contact, acceptTerms: true }, cart: { ...quantities } }
    submittingRef.current = true; remember(attempt); setSubmitting(true); setError('')
    try {
      const receipt = await placeOrder(attempt.key, attempt.command)
      saveReceipt(receipt); remember(null); onPlaced(attempt.cart); navigate('/orders/' + receipt.reference, { replace: true, state: receipt })
    } catch (e) {
      const known = e instanceof AuthError
      setError(e instanceof Error ? e.message : 'Chưa xác nhận được kết quả đặt hàng. Vui lòng kiểm tra lại bằng nút bên dưới.')
      if (known && (['quote_expired','quote_invalid','price_changed','stock_changed','invalid_order'].includes(e.code || ''))) {
        remember(null); setAccepted(false); quote.retry()
      }
      // Network errors and uncertain results keep the exact payload/key, including after refresh.
    } finally { submittingRef.current = false; setSubmitting(false) }
  }
  if (!Object.keys(quantities).length && !pending) return <section className="container basket-page"><h1>Giỏ hàng đang trống</h1><Link className="button primary" to="/products">Chọn một món gốm <Icon name="arrow" /></Link></section>
  return <section className="checkout-page container" aria-labelledby="checkout-title"><nav className="breadcrumbs" aria-label="Đường dẫn"><Link to="/cart">Giỏ hàng</Link><span>/</span><span>Đặt hàng</span></nav><div className="checkout-heading"><p className="eyebrow">THÊM MỘT CHÚT GỐM CHO NHÀ</p><h1 id="checkout-title">Sắp về <em>bên bạn.</em></h1><p>Kiểm tra món gốm và thông tin nhận hàng trước khi xác nhận.</p></div>
    <div className="checkout-layout"><form className="checkout-form" onSubmit={submit}><h2>Thông tin giao hàng</h2>{!auth.user && <p className="checkout-signin">Bạn có thể đặt hàng ngay hoặc <Link to="/login">đăng nhập</Link> để liên kết đơn với tài khoản.</p>}<fieldset disabled={submitting || !!pending}><div className="checkout-fields"><label>Họ và tên<input aria-label="Họ và tên người nhận" required minLength={2} maxLength={100} autoComplete="shipping name" value={contact.name} onChange={e => update('name',e.target.value)} /></label><label>Số điện thoại<input aria-label="Số điện thoại" required type="tel" maxLength={20} autoComplete="shipping tel" value={contact.phone} onChange={e => update('phone',e.target.value)} /></label><label className="full">Email (không bắt buộc)<input aria-label="Email nhận hàng" type="email" maxLength={254} autoComplete="shipping email" value={contact.email} onChange={e => update('email',e.target.value)} /></label><label className="full">Tỉnh / thành phố<input aria-label="Tỉnh / thành phố" required minLength={2} maxLength={100} autoComplete="shipping address-level1" value={contact.province} onChange={e => update('province',e.target.value)} /></label><label className="full">Địa chỉ nhận hàng<input aria-label="Địa chỉ nhận hàng" required minLength={10} maxLength={500} autoComplete="shipping street-address" placeholder="Số nhà, đường, phường/xã…" value={contact.address} onChange={e => update('address',e.target.value)} /></label><label className="full">Ghi chú giao hàng<textarea aria-label="Ghi chú giao hàng" maxLength={1000} rows={3} value={contact.note} onChange={e => update('note',e.target.value)} placeholder="Chỉ dẫn tìm nhà hoặc lời nhắn cho Nàng…" /></label></div><div className="cod-method"><Icon name="bag" /><div><strong>Thanh toán khi nhận hàng (COD)</strong><p>Thanh toán cho đơn vị giao hàng khi nhận sản phẩm.</p></div></div><label className="checkout-consent"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} /> Tôi đã kiểm tra thông tin, đồng ý phí giao hàng và cách đóng gói bên cạnh.</label></fieldset>
    {error && <p className="auth-error" role="alert">{error}</p>}{pending && !submitting && <p className="checkout-pending" role="status">Yêu cầu đang chờ xác nhận kết quả. Kiểm tra lại bằng cùng mã yêu cầu để tránh tạo đơn trùng.</p>}
    <button className="button primary checkout-submit" type="submit" disabled={submitting || (!pending && (!accepted || !quote.data?.canCheckout || expired || quote.loading))}>{submitting ? 'Đang xác nhận đơn…' : pending ? 'Kiểm tra lại đơn đã gửi' : 'Xác nhận đặt hàng COD'} <Icon name="arrow" /></button><Link className="checkout-back" to="/cart">Quay lại giỏ hàng</Link></form>
    <aside className="checkout-summary"><h2>Món gốm bạn chọn</h2>{quote.loading && <p role="status">Đang kiểm tra báo giá…</p>}{quote.error && <p role="alert">{quote.error} <button onClick={quote.retry}>Thử lại</button></p>}{quote.data && <><ul>{quote.data.items.map(line => <li key={line.variantId}>{line.image && <img src={line.image} alt={line.name} />}<div><strong>{line.name}</strong><span>{line.variantName} · SL {line.quantity}</span>{line.issue && <p className="checkout-line-issue">{line.issue}</p>}</div><b>{money(line.lineTotalVnd)}</b></li>)}</ul><dl className="checkout-totals"><div><dt>Tiền sản phẩm</dt><dd>{money(quote.data.subtotalVnd)}</dd></div><div><dt>Phí giao hàng</dt><dd>{quote.data.shippingFeeVnd ? money(quote.data.shippingFeeVnd) : 'Miễn phí'}</dd></div><div className="checkout-grand"><dt>Tổng thanh toán</dt><dd>{money(quote.data.grandTotalVnd)}</dd></div></dl><div className="checkout-policy"><p>{quote.data.shippingPolicy}</p><p><Icon name="gift" /> {quote.data.packingNote}</p><p>Giỏ hàng và báo giá chưa giữ tồn kho.</p></div><div className="quote-validity"><p>{expired ? 'Báo giá đã hết hạn.' : 'Báo giá có hiệu lực 5 phút; giá và tồn kho được kiểm tra lại khi đặt hàng.'}</p><button type="button" disabled={submitting || !!pending} onClick={() => { setAccepted(false); quote.retry() }}>Cập nhật báo giá</button></div></>}</aside></div>
  </section>
}
