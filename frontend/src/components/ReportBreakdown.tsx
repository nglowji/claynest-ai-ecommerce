import { useState } from 'react'
import { Link } from 'react-router-dom'
import { reportMoney, type SalesReport } from '../features/reports/api'
import { reportNumber as number, reportQuantity as quantities } from '../features/reports/utils'
import AdminIcon from './AdminIcon'
import AdminPagination from './AdminPagination'
export default function ReportBreakdown({
  report,
  view,
}: {
  report: SalesReport
  view: 'products' | 'stock'
}) {
  const [page, setPage] = useState(1)
  return view === 'products' ? (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <div>
          <h2>Sản phẩm bán chạy</h2>
          <p>Tối đa 10 biến thể · xếp theo số lượng của đơn hoàn tất</p>
        </div>
      </div>
      {report.topVariants.length ? (
        <div className="report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm / Mã</th>
                <th className="report-numeric">Số lượng</th>
                <th className="report-numeric">Tiền hàng</th>
              </tr>
            </thead>
            <tbody>
              {report.topVariants.slice((page - 1) * 5, page * 5).map((variant) => (
                <tr key={variant.variantId}>
                  <td>
                    <strong>{variant.productName}</strong>
                    <small>
                      {variant.sku} · {variant.variantName}
                    </small>
                  </td>
                  <td className="report-numeric">{quantities(variant.quantity)}</td>
                  <td className="report-numeric">{reportMoney(variant.productSalesVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="report-empty">Chưa có sản phẩm bán ra từ đơn hoàn tất trong kỳ.</p>
      )}
      <AdminPagination
        page={page}
        pageSize={5}
        totalCount={report.topVariants.length}
        onPage={setPage}
      />
    </section>
  ) : (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <div>
          <h2>Tồn kho cần chú ý</h2>
          <p>{number(report.lowStockTotal)} mã chạm ngưỡng hiện tại · hiển thị tối đa 10 mã</p>
        </div>
        <Link to="/admin/inventory?lowOnly=true">
          Xem kho <AdminIcon name="arrow" />
        </Link>
      </div>
      {report.lowStock.length ? (
        <div className="report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm / Mã</th>
                <th className="report-numeric">Tồn</th>
                <th className="report-numeric">Ngưỡng</th>
              </tr>
            </thead>
            <tbody>
              {report.lowStock.slice((page - 1) * 5, page * 5).map((variant) => (
                <tr key={variant.variantId}>
                  <td>
                    <strong>{variant.productName}</strong>
                    <small>
                      {variant.sku} · {variant.variantName}
                    </small>
                  </td>
                  <td className="report-numeric">
                    <span className="report-stock-badge">{variant.stockQty}</span>
                  </td>
                  <td className="report-numeric">{variant.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="report-empty">Không có SKU nào chạm ngưỡng cảnh báo.</p>
      )}
      <AdminPagination
        page={page}
        pageSize={5}
        totalCount={report.lowStock.length}
        onPage={setPage}
      />
    </section>
  )
}
