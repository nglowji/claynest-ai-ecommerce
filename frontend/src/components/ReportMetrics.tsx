import { reportMoney, type SalesReport } from '../features/reports/api'
import { reportNumber as number, reportChange } from '../features/reports/utils'
export default function ReportMetrics({
  report,
  previous,
  comparing,
}: {
  report: SalesReport
  previous: SalesReport | null
  comparing: boolean
}) {
  function comparison(
    key:
      | 'completedSalesVnd'
      | 'completedOrders'
      | 'averageOrderValueVnd'
      | 'grossPlacedOrderValueVnd',
  ) {
    if (comparing) return 'Đang so sánh kỳ trước…'
    const current = report.metrics[key],
      before = previous?.metrics[key]
    return current === null
      ? 'Chưa đủ dữ liệu so sánh'
      : reportChange(String(current), before == null ? null : String(before))
  }
  return (
    <div className="report-metrics">
      <article>
        <span>Doanh thu hoàn tất</span>
        <strong data-testid="completed-sales">
          {reportMoney(report.metrics.completedSalesVnd)}
        </strong>
        <p className="report-change">{comparison('completedSalesVnd')}</p>
        <small>Gồm tiền hàng và phí giao hàng</small>
      </article>
      <article>
        <span>Đơn đã hoàn tất</span>
        <strong data-testid="completed-count">{number(report.metrics.completedOrders)}</strong>
        <p className="report-change">{comparison('completedOrders')}</p>
        <small>Đã giao xong và thu tiền COD</small>
      </article>
      <article>
        <span>Giá trị đơn trung bình</span>
        <strong data-testid="average-order-value">
          {report.metrics.averageOrderValueVnd === null
            ? '—'
            : reportMoney(report.metrics.averageOrderValueVnd)}
        </strong>
        <p className="report-change">{comparison('averageOrderValueVnd')}</p>
        <small>
          {report.metrics.averageOrderValueVnd === null
            ? 'Chưa có đơn hoàn tất để tính AOV'
            : 'Doanh thu hoàn tất / số đơn hoàn tất'}
        </small>
      </article>
      <article>
        <span>Giá trị đơn mới đặt</span>
        <strong data-testid="gross-placed">
          {reportMoney(report.metrics.grossPlacedOrderValueVnd)}
        </strong>
        <p className="report-change">{comparison('grossPlacedOrderValueVnd')}</p>
        <small>{number(report.metrics.placedOrders)} đơn theo ngày đặt, gồm cả đơn hủy</small>
      </article>
    </div>
  )
}
