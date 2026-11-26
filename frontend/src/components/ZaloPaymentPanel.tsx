import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { money } from '../data/products'
import type { Receipt } from '../features/checkout/api'
import { zaloPayment, type ZaloPayment } from '../features/checkout/zalopay'
export default function ZaloPaymentPanel({
  receipt,
  onDone,
}: {
  receipt: Receipt
  onDone: () => void
}) {
  const [data, setData] = useState<ZaloPayment | null>(null)
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const lifetime = useRef<AbortController | null>(null)
  const finish = useRef(onDone)
  useEffect(() => {
    finish.current = onDone
  }, [onDone])
  async function load(create: boolean, controller: AbortController) {
    setBusy(true)
    setError('')
    try {
      const value = await zaloPayment(receipt, create, controller.signal)
      if (!controller.signal.aborted) {
        setData(value)
        if (value.state === 'paid' && value.paymentStatus === 'paid') finish.current()
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'Chưa kết nối được ZaloPay.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    void load(true, controller)
    return () => controller.abort()
  }, [receipt.reference, attempt])
  useEffect(() => {
    if (!data?.qrPayload) {
      setImage('')
      return
    }
    let active = true
    QRCode.toDataURL(data.qrPayload, { width: 320, margin: 4, errorCorrectionLevel: 'M' })
      .then((value) => {
        if (active) setImage(value)
      })
      .catch(() => {
        if (active) setError('Chưa hiển thị được QR. Bạn có thể mở cổng ZaloPay bằng nút bên dưới.')
      })
    return () => {
      active = false
    }
  }, [data?.qrPayload])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (
      busy ||
      data?.state === 'paid' ||
      data?.state === 'expired' ||
      data?.state === 'refund_required' ||
      !lifetime.current
    )
      return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && lifetime.current)
        void load(false, lifetime.current)
    }, 5000)
    return () => clearInterval(timer)
  }, [busy, data?.state, receipt.reference])
  const seconds = data ? Math.max(0, Math.ceil((Date.parse(data.expiresAt) - now) / 1000)) : 0
  const expired = !!data && seconds === 0
  return (
    <section className="zalo-payment-panel" aria-labelledby="zalo-payment-title">
      <p className="eyebrow">ZALOPAY SANDBOX · MÔI TRƯỜNG KIỂM THỬ</p>
      <h1 id="zalo-payment-title">Quét mã để thanh toán</h1>
      <p>Đơn {receipt.reference}</p>
      <strong className="zalo-amount">{money(data?.amount ?? receipt.grandTotalVnd)}</strong>
      {data?.state === 'refund_required' ? (
        <p role="alert">
          ZaloPay đã ghi nhận tiền nhưng đơn đã hủy. Liên hệ Nàng để đối soát và hoàn tiền.
        </p>
      ) : data?.state === 'expired' ? (
        <p role="status">
          Giao dịch đã hết hạn và chưa thanh toán. Đơn hàng được hủy, số lượng được hoàn lại kho.
        </p>
      ) : expired ? (
        <p role="status">Mã đã hết thời gian quét. Đang kiểm tra kết quả cuối cùng với ZaloPay…</p>
      ) : image ? (
        <>
          <img
            className="zalo-qr"
            src={image}
            alt={'Mã QR ZaloPay cho đơn ' + receipt.reference}
            width={320}
            height={320}
          />
          <p className="zalo-countdown">
            Còn {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} để thanh toán
          </p>
          <p>Dùng ứng dụng ZaloPay Sandbox để quét mã.</p>
        </>
      ) : (
        <p role="status">
          {busy
            ? 'Đang tạo mã QR…'
            : 'Chưa nhận được mã QR. Thử lại hoặc kiểm tra giao dịch đã gửi.'}
        </p>
      )}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="zalo-actions">
        {data?.orderUrl && !expired && data.state !== 'refund_required' && (
          <a className="button primary" href={data.orderUrl}>
            Mở cổng ZaloPay
          </a>
        )}
        {image && !expired && (
          <a
            className="button secondary"
            href={image}
            download={'nang-gom-' + receipt.reference + '.png'}
          >
            Tải mã QR
          </a>
        )}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            if (lifetime.current) void load(false, lifetime.current)
          }}
        >
          Kiểm tra thanh toán
        </button>
        {!image && !expired && (
          <button disabled={busy} onClick={() => setAttempt((v) => v + 1)}>
            Thử tạo lại mã
          </button>
        )}
        <button className="text-link" onClick={onDone}>
          Theo dõi đơn hàng
        </button>
      </div>
      <p className="zalo-payment-note">
        Trạng thái chỉ cập nhật sau khi hệ thống xác minh với ZaloPay. Không cần tạo đơn mới nếu
        phản hồi chậm.
      </p>
    </section>
  )
}
