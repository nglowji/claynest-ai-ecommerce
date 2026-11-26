import ZaloPaymentPanel from './ZaloPaymentPanel'
import { activeZalo, rememberZalo, paymentMethods } from '../features/checkout/zalopay'
import CheckoutSummary from './CheckoutSummary'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import type { Cart } from '../features/cart/useCart'
import {
  placeOrder,
  saveReceipt,
  lookupOrder,
  savedToken,
  type Receipt,
  type Checkout,
  type Contact,
} from '../features/checkout/api'
import { useQuote } from '../features/checkout/useQuote'
import Icon from './Icon'

type Attempt = { key: string; command: Checkout; cart: Cart }
const pendingKey = 'nang-gom-checkout-pending'
function restore(): Attempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey) || 'null')
    return value &&
      value.cart &&
      typeof value.cart === 'object' &&
      typeof value.key === 'string' &&
      typeof value.command?.quoteToken === 'string' &&
      value.command?.acceptTerms === true &&
      ['name', 'phone', 'email', 'province', 'address', 'note'].every(
        (k) => typeof value.command?.contact?.[k] === 'string',
      )
      ? value
      : null
  } catch {
    return null
  }
}
export default function CheckoutPage({
  quantities,
  onPlaced,
}: {
  quantities: Cart
  onPlaced: (ordered: Cart) => void
}) {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const resume = params.get('pay') || ''
  const [activePayment, setActivePayment] = useState<Receipt | null>(activeZalo)
  const [resumeError, setResumeError] = useState('')
  const [zaloEnabled, setZaloEnabled] = useState(false)
  const [method, setMethod] = useState<'cod' | 'zalopay'>(() =>
    restore()?.command.paymentMethod === 'zalopay' ? 'zalopay' : 'cod',
  )
  const quote = useQuote(quantities)
  useEffect(() => {
    const abort = new AbortController()
    paymentMethods(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setZaloEnabled(value.zaloPayEnabled)
      })
      .catch(() => {})
    return () => abort.abort()
  }, [])
  useEffect(() => {
    if (!resume || activePayment?.reference === resume) return
    const abort = new AbortController()
    setResumeError('')
    lookupOrder(resume, savedToken(resume), abort.signal)
      .then((order) => {
        if (abort.signal.aborted) return
        if (order.paymentMethod !== 'zalopay' || order.status === 'cancelled') {
          setResumeError('Đơn này không có giao dịch ZaloPay đang chờ thanh toán.')
          return
        }
        if (order.paymentStatus === 'paid') {
          navigate('/orders/' + order.reference, { replace: true })
          return
        }
        const receipt: Receipt = {
          reference: order.reference,
          accessToken: savedToken(resume),
          accessExpiresAt: new Date(Date.parse(order.createdAt) + 30 * 86400000).toISOString(),
          grandTotalVnd: order.grandTotalVnd,
          status: order.status,
          paymentMethod: 'zalopay',
        }
        rememberZalo(receipt)
        setActivePayment(receipt)
      })
      .catch((failure) => {
        if (!abort.signal.aborted)
          setResumeError(
            failure instanceof Error ? failure.message : 'Chưa tải được đơn thanh toán.',
          )
      })
    return () => abort.abort()
  }, [resume])
  const [pending, setPending] = useState<Attempt | null>(restore)
  const [contact, setContact] = useState<Contact>(
    () =>
      restore()?.command.contact || {
        name: auth.user?.displayName || '',
        email: auth.user?.email || '',
        phone: '',
        province: '',
        address: '',
        note: '',
      },
  )
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    setAccepted(false)
  }, [quote.data?.quoteToken])
  useEffect(() => {
    if (pending || !auth.user) return
    setContact((current) => ({
      ...current,
      name: current.name || auth.user!.displayName,
      email: current.email || auth.user!.email,
    }))
  }, [auth.user?.id])
  const expired = !!quote.data && Date.parse(quote.data.expiresAt) <= now
  const update = (key: keyof Contact, value: string) =>
    setContact((current) => ({ ...current, [key]: value }))
  function remember(value: Attempt | null) {
    setPending(value)
    try {
      value
        ? sessionStorage.setItem(pendingKey, JSON.stringify(value))
        : sessionStorage.removeItem(pendingKey)
    } catch {
      /* The same in-memory attempt is reused while this tab remains open. */
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submittingRef.current) return
    if (!pending && (!accepted || !quote.data?.canCheckout || !quote.data.quoteToken || expired))
      return
    const attempt = pending || {
      key: crypto.randomUUID(),
      command: {
        quoteToken: quote.data!.quoteToken!,
        contact,
        acceptTerms: true,
        paymentMethod: method,
      },
      cart: { ...quantities },
    }
    submittingRef.current = true
    remember(attempt)
    setSubmitting(true)
    setError('')
    try {
      const receipt = await placeOrder(attempt.key, attempt.command)
      saveReceipt(receipt)
      if (receipt.paymentMethod === 'zalopay') {
        rememberZalo(receipt)
        setActivePayment(receipt)
        remember(null)
        onPlaced(attempt.cart)
        return
      }
      remember(null)
      onPlaced(attempt.cart)
      navigate('/orders/' + receipt.reference, { replace: true, state: receipt })
    } catch (e) {
      const known = e instanceof AuthError
      setError(
        e instanceof Error
          ? e.message
          : 'Chưa xác nhận được kết quả đặt hàng. Vui lòng kiểm tra lại bằng nút bên dưới.',
      )
      if (
        known &&
        [
          'quote_expired',
          'quote_invalid',
          'price_changed',
          'stock_changed',
          'invalid_order',
        ].includes(e.code || '')
      ) {
        remember(null)
        setAccepted(false)
        quote.retry()
      }
      // Network errors and uncertain results keep the exact payload/key, including after refresh.
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }
  if (resume && activePayment?.reference !== resume)
    return (
      <section className="container checkout-page">
        {resumeError ? (
          <p role="alert">{resumeError}</p>
        ) : (
          <p role="status">Đang kiểm tra đơn thanh toán…</p>
        )}
        <Link to="/orders">Tra cứu đơn hàng</Link>
      </section>
    )
  if (activePayment)
    return (
      <section className="container checkout-page">
        <ZaloPaymentPanel
          receipt={activePayment}
          onDone={() => {
            rememberZalo(null)
            setActivePayment(null)
            navigate('/orders/' + activePayment.reference, { replace: true, state: activePayment })
          }}
        />
      </section>
    )
  if (!Object.keys(quantities).length && !pending)
    return (
      <section className="container basket-page">
        <h1>Giỏ hàng đang trống</h1>
        <Link className="button primary" to="/products">
          Chọn một món gốm <Icon name="arrow" />
        </Link>
      </section>
    )
  return (
    <section className="checkout-page container" aria-labelledby="checkout-title">
      <nav className="breadcrumbs" aria-label="Đường dẫn">
        <Link to="/cart">Giỏ hàng</Link>
        <span>/</span>
        <span>Đặt hàng</span>
      </nav>
      <ol className="commerce-steps" aria-label="Các bước đặt hàng">
        <li>
          <Link to="/cart">01 · Giỏ hàng</Link>
        </li>
        <li aria-current="step">02 · Giao hàng &amp; thanh toán</li>
        <li>03 · Hoàn tất</li>
      </ol>
      <div className="checkout-heading">
        <p className="eyebrow">THÊM MỘT CHÚT GỐM CHO NHÀ</p>
        <h1 id="checkout-title">Giao hàng &amp; thanh toán</h1>
        <p>Kiểm tra món gốm và thông tin nhận hàng trước khi xác nhận.</p>
      </div>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <h2>Thông tin giao hàng</h2>
          {!auth.user && (
            <p className="checkout-signin">
              Bạn có thể đặt hàng ngay hoặc <Link to="/login?next=%2Fcheckout">đăng nhập</Link> để
              liên kết đơn với tài khoản.
            </p>
          )}
          <fieldset disabled={submitting || !!pending}>
            <div className="checkout-fields">
              <label>
                Họ và tên
                <input
                  aria-label="Họ và tên người nhận"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="shipping name"
                  value={contact.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </label>
              <label>
                Số điện thoại
                <input
                  aria-label="Số điện thoại"
                  required
                  type="tel"
                  maxLength={20}
                  autoComplete="shipping tel"
                  value={contact.phone}
                  onChange={(e) => update('phone', e.target.value)}
                />
              </label>
              <label className="full">
                Email (không bắt buộc)
                <input
                  aria-label="Email nhận hàng"
                  type="email"
                  maxLength={254}
                  autoComplete="shipping email"
                  value={contact.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </label>
              <label className="full">
                Tỉnh / thành phố
                <input
                  aria-label="Tỉnh / thành phố"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="shipping address-level1"
                  value={contact.province}
                  onChange={(e) => update('province', e.target.value)}
                />
              </label>
              <label className="full">
                Địa chỉ nhận hàng
                <input
                  aria-label="Địa chỉ nhận hàng"
                  required
                  minLength={10}
                  maxLength={500}
                  autoComplete="shipping street-address"
                  placeholder="Số nhà, đường, phường/xã…"
                  value={contact.address}
                  onChange={(e) => update('address', e.target.value)}
                />
              </label>
              <label className="full">
                Ghi chú giao hàng
                <textarea
                  aria-label="Ghi chú giao hàng"
                  maxLength={1000}
                  rows={3}
                  value={contact.note}
                  onChange={(e) => update('note', e.target.value)}
                  placeholder="Chỉ dẫn tìm nhà hoặc lời nhắn cho Nàng…"
                />
              </label>
            </div>
            <fieldset className="checkout-payment-methods">
              <legend>Phương thức thanh toán</legend>
              <label className="payment-choice">
                <input
                  type="radio"
                  name="payment-method"
                  value="cod"
                  checked={method === 'cod'}
                  onChange={() => setMethod('cod')}
                />
                <span>
                  <strong>Thanh toán khi nhận hàng (COD)</strong>
                  <small>Thanh toán cho đơn vị giao hàng khi nhận sản phẩm.</small>
                </span>
              </label>
              {zaloEnabled && (
                <label className="payment-choice">
                  <input
                    type="radio"
                    name="payment-method"
                    value="zalopay"
                    checked={method === 'zalopay'}
                    onChange={() => setMethod('zalopay')}
                  />
                  <span>
                    <strong>ZaloPay · Quét mã QR</strong>
                    <small>Sandbox · Tạo QR và theo dõi thanh toán ngay tại đây.</small>
                  </span>
                </label>
              )}
            </fieldset>
            <label className="checkout-consent">
              <input
                type="checkbox"
                required
                disabled={quote.loading || !quote.data?.canCheckout || expired}
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />{' '}
              Tôi đã kiểm tra thông tin, đồng ý phí giao hàng và cách đóng gói của đơn hàng.
            </label>
          </fieldset>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {pending && !submitting && (
            <p className="checkout-pending" role="status">
              Chưa nhận được kết quả đặt hàng. Chọn kiểm tra lại đơn đã gửi để xác nhận mà không đặt
              thêm đơn mới.
            </p>
          )}
          <button
            className="button primary checkout-submit"
            type="submit"
            disabled={
              submitting ||
              (!pending && (!accepted || !quote.data?.canCheckout || expired || quote.loading))
            }
          >
            {submitting
              ? 'Đang xác nhận đơn…'
              : pending
                ? 'Kiểm tra lại đơn đã gửi'
                : method === 'zalopay'
                  ? 'Tạo mã QR ZaloPay'
                  : 'Xác nhận đặt hàng COD'}{' '}
            <Icon name="arrow" />
          </button>
          <Link className="checkout-back" to="/cart">
            Quay lại giỏ hàng
          </Link>
        </form>
        <CheckoutSummary
          quote={quote}
          pending={!!pending}
          locked={submitting || !!pending}
          expired={expired}
          onRetry={() => {
            setAccepted(false)
            quote.retry()
          }}
        />
      </div>
    </section>
  )
}
