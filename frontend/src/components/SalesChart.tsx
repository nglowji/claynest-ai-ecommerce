import { useId, useState } from 'react'
import { reportMoney, type SalesReport } from '../features/reports/api'
import { fullDate, reportNumber as number } from '../features/reports/utils'
import AdminIcon from './AdminIcon'
import AdminPagination from './AdminPagination'
export default function SalesChart({ report }: { report: SalesReport }) {
  const gradientId = useId()
  const [page, setPage] = useState(1)
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...report.trend.map((p) => Number(p.salesVnd)), 1)
  const width = 800,
    height = 210,
    pad = 22,
    left = 70,
    right = 22
  const x = (index: number) =>
    left + (index * (width - left - right)) / Math.max(1, report.trend.length - 1)
  const y = (value: string) => height - pad - (Number(value) / max) * (height - 2 * pad)
  const line = report.trend.map((point, index) => x(index) + ',' + y(point.salesVnd)).join(' ')
  const point = active !== null ? report.trend[active] : null
  return (
    <>
      <div className="report-chart-summary">
        <span>
          <i />
          Doanh thu đơn hoàn tất
        </span>
        {point ? (
          <strong>
            {fullDate(point.from)}
            {point.to !== point.from ? ' – ' + fullDate(point.to) : ''} ·{' '}
            {reportMoney(point.salesVnd)} · {point.completedOrders} đơn
          </strong>
        ) : (
          <small>Di chuột hoặc chọn điểm để xem chi tiết</small>
        )}
      </div>
      {report.metrics.completedOrders === 0 ? (
        <div className="report-chart-empty">
          <AdminIcon name="reports" />
          <h3>Chưa có đơn hoàn tất trong kỳ</h3>
          <p>Doanh thu sẽ được ghi nhận khi đơn giao xong và đã thu tiền COD.</p>
        </div>
      ) : (
        <div className="report-chart">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            aria-label="Biểu đồ doanh thu đơn hoàn tất theo kỳ báo cáo"
            onMouseLeave={() => setActive(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7e9c69" stopOpacity=".22" />
                <stop offset="100%" stopColor="#7e9c69" stopOpacity=".02" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={pad + t * (height - 2 * pad)}
                  y2={pad + t * (height - 2 * pad)}
                  stroke="#ecf0e7"
                  strokeDasharray="4 5"
                />
                <text
                  className="report-y-axis"
                  x={left - 12}
                  y={pad + t * (height - 2 * pad) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#9ca98f"
                >
                  {new Intl.NumberFormat('vi-VN', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(max * (1 - t))}
                </text>
              </g>
            ))}
            <polygon
              points={`${left},${height - pad} ${line} ${x(report.trend.length - 1)},${height - pad}`}
              fill={`url(#${gradientId})`}
            />
            <polyline
              points={line}
              fill="none"
              stroke="#6e9057"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {report.trend.map((p, index) => (
              <g key={p.bucketStart}>
                <rect
                  x={x(index) - Math.max(4, (width - left - right) / report.trend.length / 2)}
                  y="0"
                  width={Math.max(8, (width - left - right) / report.trend.length)}
                  height={height}
                  fill="transparent"
                  onPointerDown={() => setActive(index)}
                  onMouseEnter={() => setActive(index)}
                />
                <circle
                  cx={x(index)}
                  cy={y(p.salesVnd)}
                  r={active === index ? 5 : report.trend.length < 40 ? 3 : 2}
                  fill="#fff"
                  stroke="#6e9057"
                  strokeWidth="2"
                  tabIndex={report.trend.length <= 60 ? 0 : undefined}
                  role="img"
                  aria-label={`${fullDate(p.from)}: ${reportMoney(p.salesVnd)}, ${p.completedOrders} đơn`}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  onMouseEnter={() => setActive(index)}
                >
                  <title>
                    {fullDate(p.from)}: {reportMoney(p.salesVnd)}
                  </title>
                </circle>
              </g>
            ))}
          </svg>
          <div className="report-chart-axis">
            <span>{fullDate(report.trend[0].from)}</span>
            <span>{fullDate(report.trend[report.trend.length - 1].to)}</span>
          </div>
        </div>
      )}
      <details className="report-data-details">
        <summary>Xem bảng số liệu</summary>
        <div className="report-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kỳ</th>
                <th className="report-numeric">Đơn hoàn tất</th>
                <th className="report-numeric">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {report.trend.slice((page - 1) * 10, page * 10).map((p) => (
                <tr key={p.bucketStart}>
                  <td>
                    {fullDate(p.from)}
                    {p.to !== p.from ? ' – ' + fullDate(p.to) : ''}
                  </td>
                  <td className="report-numeric">{number(p.completedOrders)}</td>
                  <td className="report-numeric">{reportMoney(p.salesVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminPagination
          page={page}
          pageSize={10}
          totalCount={report.trend.length}
          onPage={setPage}
        />
      </details>
    </>
  )
}
