import { useState } from 'react'
import type { SalesReport } from '../features/reports/api'
import { reportMoney } from '../features/reports/api'
import { fullDate, reportNumber } from '../features/reports/utils'
import AdminPagination from './AdminPagination'
export default function ReportTrendTable({ report }: { report: SalesReport }) {
  const [page, setPage] = useState(1)
  const [reverse, setReverse] = useState(false)
  const rows = reverse ? [...report.trend].reverse() : report.trend
  return (
    <section className="dashboard-panel report-detail-panel">
      <div className="dashboard-panel-heading">
        <div>
          <h2>Chi tiết từng kỳ</h2>
          <p>Tổng cộng {rows.length} kỳ · tối đa 10 dòng mỗi trang</p>
        </div>
        <label>
          Sắp xếp kỳ
          <select
            aria-label="Sắp xếp kỳ báo cáo"
            value={reverse ? 'desc' : 'asc'}
            onChange={(e) => {
              setReverse(e.target.value === 'desc')
              setPage(1)
            }}
          >
            <option value="asc">Cũ đến mới</option>
            <option value="desc">Mới đến cũ</option>
          </select>
        </label>
      </div>
      <div className="report-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kỳ thống kê</th>
              <th className="report-numeric">Đơn hoàn tất</th>
              <th className="report-numeric">Doanh thu</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * 10, page * 10).map((row) => (
              <tr key={row.bucketStart}>
                <td>
                  {fullDate(row.from)}
                  {row.from !== row.to ? ' – ' + fullDate(row.to) : ''}
                </td>
                <td className="report-numeric">{reportNumber(row.completedOrders)}</td>
                <td className="report-numeric">{reportMoney(row.salesVnd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminPagination page={page} pageSize={10} totalCount={rows.length} onPage={setPage} />
    </section>
  )
}
