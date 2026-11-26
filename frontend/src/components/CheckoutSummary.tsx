import SiteImage from './SiteImage'
import Icon from './Icon'
import { money } from '../data/products'
import type { CartQuote } from '../features/checkout/api'
export default function CheckoutSummary({
  quote,
  pending,
  locked,
  expired,
  onRetry,
}: {
  quote: { data: CartQuote | null; loading: boolean; error: string }
  pending: boolean
  locked: boolean
  expired: boolean
  onRetry: () => void
}) {
  return (
    <aside className="checkout-summary">
      <h2>Món gốm bạn chọn</h2>
      {pending ? (
        <p className="checkout-pending" role="status">
          Đang đối chiếu kết quả đơn đã gửi. Chi tiết thanh toán sẽ hiển thị khi xác nhận xong.
        </p>
      ) : (
        <>
          {quote.loading && <p role="status">Đang kiểm tra báo giá…</p>}
          {quote.error && (
            <p role="alert">
              {quote.error} <button onClick={onRetry}>Thử lại</button>
            </p>
          )}
          {quote.data && (
            <>
              <ul>
                {quote.data.items.map((line) => (
                  <li key={line.variantId}>
                    {line.image && <SiteImage src={line.image} alt={line.name} />}
                    <div>
                      <strong>{line.name}</strong>
                      <span>
                        {line.variantName} · SL {line.quantity}
                      </span>
                      {line.issue && <p className="checkout-line-issue">{line.issue}</p>}
                    </div>
                    <b>{money(line.lineTotalVnd)}</b>
                  </li>
                ))}
              </ul>
              <dl className="checkout-totals">
                <div>
                  <dt>Tiền sản phẩm</dt>
                  <dd>{money(quote.data.subtotalVnd)}</dd>
                </div>
                <div>
                  <dt>Phí giao hàng</dt>
                  <dd>
                    {quote.data.shippingFeeVnd ? money(quote.data.shippingFeeVnd) : 'Miễn phí'}
                  </dd>
                </div>
                <div className="checkout-grand">
                  <dt>Tổng thanh toán</dt>
                  <dd>{money(quote.data.grandTotalVnd)}</dd>
                </div>
              </dl>
              <div className="checkout-policy">
                <p>{quote.data.shippingPolicy}</p>
                <p>
                  <Icon name="gift" /> {quote.data.packingNote}
                </p>
                <p>Giỏ hàng và báo giá chưa giữ tồn kho.</p>
              </div>
              <div className="quote-validity">
                <p>
                  {expired
                    ? 'Báo giá đã hết hạn.'
                    : 'Báo giá có hiệu lực 5 phút; giá và tồn kho được kiểm tra lại khi đặt hàng.'}
                </p>
                <button type="button" disabled={locked} onClick={onRetry}>
                  Cập nhật báo giá
                </button>
              </div>
            </>
          )}
        </>
      )}
    </aside>
  )
}
