import { Link } from 'react-router-dom'
import type { SalesReport } from '../features/reports/api'
import { reportMoney } from '../features/reports/api'
import AdminIcon from './AdminIcon'

export default function DashboardInsights({
  report,
  reportUrl,
}: {
  report: SalesReport
  reportUrl: string
}) {
  return (
    <div className="dashboard-insights-grid">
      <section className="dashboard-panel" aria-labelledby="dashboard-top-title">
        <div className="dashboard-panel-heading">
          <div>
            <p className="dashboard-section-label">NHỮNG MÓN ĐƯỢC YÊU</p>
            <h2 id="dashboard-top-title">Sản phẩm bán nhiều</h2>
            <p>Theo số lượng trong đơn hoàn tất của kỳ đã chọn</p>
          </div>
          <Link to={reportUrl}>Xem báo cáo</Link>
        </div>
        {report.topVariants.length ? (
          <ol className="dashboard-ranking">
            {report.topVariants.slice(0, 2).map((item, index) => (
              <li key={item.variantId}>
                <span className="dashboard-rank">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{item.productName}</strong>
                  <small>
                    {item.variantName} · {item.sku}
                  </small>
                </div>
                <div>
                  <b>{new Intl.NumberFormat('vi-VN').format(BigInt(item.quantity))} món</b>
                  <small>{reportMoney(item.productSalesVnd)}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="dashboard-empty">
            <h3>Chưa có sản phẩm bán ra trong kỳ</h3>
            <p>Danh sách sẽ cập nhật khi có đơn hoàn tất.</p>
          </div>
        )}
      </section>
      <section
        className="dashboard-panel dashboard-stock-panel"
        aria-labelledby="dashboard-stock-title"
      >
        <div className="dashboard-panel-heading">
          <div>
            <p className="dashboard-section-label">CHĂM CHÚT KHO HÀNG</p>
            <h2 id="dashboard-stock-title">Cảnh báo tồn kho</h2>
            <p>{report.lowStockTotal} SKU cần chú ý · Tồn kho hiện tại</p>
          </div>
          <Link to="/admin/inventory?lowOnly=true">Kiểm tra kho</Link>
        </div>
        {report.lowStock.length ? (
          <ul className="dashboard-stock-list">
            {report.lowStock.slice(0, 2).map((item) => (
              <li key={item.variantId}>
                <div>
                  <Link to={'/admin/inventory?q=' + encodeURIComponent(item.sku)}>
                    {item.productName}
                  </Link>
                  <small>
                    {item.variantName} · {item.sku}
                  </small>
                </div>
                <span className={item.stockQty === 0 ? 'stock-empty' : ''}>
                  {item.stockQty === 0 ? 'Hết hàng' : `Còn ${item.stockQty}`}
                  <small>Ngưỡng {item.threshold}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="dashboard-stock-clear">
            <AdminIcon name="check" />
            <h3>Kho hàng đang ổn</h3>
            <p>Không có SKU chạm ngưỡng cảnh báo.</p>
            <Link to="/admin/inventory">Quản lý tồn kho</Link>
          </div>
        )}
      </section>
    </div>
  )
}
