import { Link } from 'react-router-dom'
import { reportMoney, type SalesReport } from '../features/reports/api'
import { fullDate, reportQuantity } from '../features/reports/utils'
export default function ReportInsights({ report }: { report: SalesReport }) {
  const best = report.trend.reduce<SalesReport['trend'][number] | null>(
    (best, row) => (!best || BigInt(row.salesVnd) > BigInt(best.salesVnd) ? row : best),
    null,
  )
  const total = BigInt(report.metrics.completedSalesVnd)
  const share =
    total > 0n ? Number((BigInt(report.metrics.productSalesVnd) * 1000n) / total) / 10 : 0
  const leader = report.topVariants[0]
  return (
    <aside className="report-insights" aria-label="Phân tích kỳ báo cáo">
      <article>
        <h2>Cơ cấu doanh thu</h2>
        <dl>
          <div>
            <dt>Tiền hàng</dt>
            <dd>{reportMoney(report.metrics.productSalesVnd)}</dd>
          </div>
          <div>
            <dt>Phí giao hàng</dt>
            <dd>{reportMoney(report.metrics.shippingCollectedVnd)}</dd>
          </div>
        </dl>
        {total > 0n && (
          <>
            <div
              className="report-composition"
              role="img"
              aria-label={'Tiền hàng chiếm ' + share + '% doanh thu'}
            >
              <span style={{ width: share + '%' }} />
            </div>
            <small>Tiền hàng chiếm {share.toLocaleString('vi-VN')}% tổng doanh thu hoàn tất.</small>
          </>
        )}
      </article>
      <article>
        <h2>Kỳ doanh thu cao nhất</h2>
        {best && BigInt(best.salesVnd) > 0n ? (
          <>
            <strong>{reportMoney(best.salesVnd)}</strong>
            <p>
              {fullDate(best.from)}
              {best.from !== best.to ? ' – ' + fullDate(best.to) : ''} · {best.completedOrders} đơn
              hoàn tất
            </p>
          </>
        ) : (
          <p>Chưa có doanh thu để xác định kỳ nổi bật.</p>
        )}
      </article>
      <article>
        <h2>Dẫn đầu về số lượng</h2>
        {leader ? (
          <>
            <strong>{leader.productName}</strong>
            <p>
              {reportQuantity(leader.quantity)} món · {reportMoney(leader.productSalesVnd)} tiền
              hàng
            </p>
          </>
        ) : (
          <p>Chưa có sản phẩm bán ra từ đơn hoàn tất.</p>
        )}
        <Link to="/admin/products">Quản lý sản phẩm →</Link>
      </article>
    </aside>
  )
}
