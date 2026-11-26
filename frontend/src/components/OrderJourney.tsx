import type { OrderStatus } from '../features/checkout/api'
import { purchaseDate, purchaseLabels } from '../features/checkout/purchases'
const stages = [
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'packed', label: 'Đã đóng gói' },
  { key: 'shipped', label: 'Đang giao hàng' },
  { key: 'completed', label: 'Hoàn tất' },
]
export default function OrderJourney({ order }: { order: OrderStatus }) {
  const events = new Map(order.timeline.map((step) => [step.status, step.changedAt]))
  events.set('pending', order.createdAt)
  const index = stages.findIndex((s) => s.key === order.status)
  if (order.status === 'cancelled')
    return (
      <>
        <section className="order-cancelled">
          <h2>Đơn hàng đã hủy</h2>
          <p>
            {order.cancelledAt ? purchaseDate(order.cancelledAt) : 'Đơn đã dừng xử lý'} ·{' '}
            {order.paymentStatus === 'refund_required'
              ? 'Cần đối soát khoản thanh toán ZaloPay.'
              : order.paymentMethod === 'zalopay'
                ? 'Giao dịch chưa thanh toán.'
                : 'Không thu tiền COD.'}
          </p>
        </section>
        <ol className="order-progress" aria-label="Lịch sử đơn đã hủy">
          {order.timeline.map((event, index) => (
            <li key={index}>
              <strong>{purchaseLabels[event.status] || event.status}</strong>
              <time dateTime={event.changedAt}>{purchaseDate(event.changedAt)}</time>
            </li>
          ))}
        </ol>
      </>
    )
  return (
    <ol className="order-progress order-journey" aria-label="Hành trình đơn hàng">
      {stages.map((stage, i) => (
        <li
          key={stage.key}
          className={i <= index ? 'reached' : ''}
          aria-current={stage.key === order.status ? 'step' : undefined}
        >
          <span aria-hidden="true">{i < index ? '✓' : i + 1}</span>
          <div>
            <strong>{stage.label}</strong>
            {events.has(stage.key) ? (
              <time dateTime={events.get(stage.key)}>{purchaseDate(events.get(stage.key)!)}</time>
            ) : (
              <small>Chưa cập nhật</small>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
