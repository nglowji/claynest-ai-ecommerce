import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { getSalesReport, reportMoney, type SalesReport } from '../features/reports/api'
import AdminIcon from './AdminIcon'

function todayVN() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function previousDay(date: string, days: number) {
  const value = new Date(date + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}
const shortDate = (date: string) => date.slice(8, 10) + '/' + date.slice(5, 7)
const fullDate = (date: string) => shortDate(date) + '/' + date.slice(0, 4)
const number = (value: number) => value.toLocaleString('vi-VN')
const quantities = (value: string) => new Intl.NumberFormat('vi-VN').format(BigInt(value))

export function SalesChart({ report }: { report: SalesReport }) {
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
              <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#sales-fill)"
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
              {report.trend.map((p) => (
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
      </details>
    </>
  )
}

export default function AdminReportsPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const signature = params.toString()
  const [from, setFrom] = useState(params.get('from') || previousDay(todayVN(), 29))
  const [to, setTo] = useState(params.get('to') || todayVN())
  const [grain, setGrain] = useState(params.get('grain') || 'day')
  const [report, setReport] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  useEffect(() => {
    setFrom(params.get('from') || previousDay(todayVN(), 29))
    setTo(params.get('to') || todayVN())
    setGrain(params.get('grain') || 'day')
  }, [signature])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setReport(null)
    getSalesReport(new URLSearchParams(signature), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setReport(data)
          setLoading(false)
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          if (failure instanceof AuthError && failure.status === 401) auth.expire()
          setError(failure instanceof Error ? failure.message : 'Chưa tải được báo cáo.')
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [signature, attempt])
  function apply(start = from, end = to, group = grain) {
    setParams(new URLSearchParams({ from: start, to: end, grain: group }))
    if (signature === new URLSearchParams({ from: start, to: end, grain: group }).toString())
      setAttempt((v) => v + 1)
  }
  async function download() {
    if (!report || exporting) return
    setExporting(true)
    setExportError('')
    try {
      const query = new URLSearchParams({
        from: report.period.from,
        to: report.period.to,
        grain: report.period.grain,
      })
      const response = await fetch('/api/v1/admin/reports/export.csv?' + query, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      })
      if (response.status === 401) auth.expire()
      if (!response.ok) throw new Error('Chưa xuất được CSV. Vui lòng thử lại.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `nang-gom-report-${report.period.from}-${report.period.to}-${report.period.grain}.csv`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) {
      setExportError(failure instanceof Error ? failure.message : 'Chưa xuất được CSV.')
    } finally {
      setExporting(false)
    }
  }
  return (
    <section className="admin-reports container">
      <header className="report-heading">
        <div>
          <p className="dashboard-eyebrow">SỐ LIỆU KINH DOANH</p>
          <h1>Báo cáo bán hàng</h1>
          <p>Theo dõi doanh thu đã ghi nhận và hiệu quả từng sản phẩm.</p>
        </div>
        <div className="report-heading-actions">
          <button disabled={loading} onClick={() => setAttempt((v) => v + 1)}>
            <AdminIcon name="refresh" />
            Làm mới
          </button>
          <button
            className="knowledge-primary"
            disabled={!report || loading || exporting}
            onClick={() => void download()}
          >
            <AdminIcon name="download" />
            {exporting ? 'Đang xuất…' : 'Xuất CSV'}
          </button>
        </div>
      </header>
      <form
        className="report-filters"
        onSubmit={(event) => {
          event.preventDefault()
          apply()
        }}
      >
        <label>
          Từ ngày
          <input
            aria-label="Báo cáo từ ngày"
            type="date"
            required
            min="2000-01-01"
            max="2100-12-31"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Đến ngày
          <input
            aria-label="Báo cáo đến ngày"
            type="date"
            required
            min={from || '2000-01-01'}
            max="2100-12-31"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Nhóm theo
          <select
            aria-label="Nhóm báo cáo theo"
            value={grain}
            onChange={(e) => setGrain(e.target.value)}
          >
            <option value="day">Ngày</option>
            <option value="week">Tuần (thứ Hai)</option>
            <option value="month">Tháng</option>
          </select>
        </label>
        <button className="report-apply" disabled={loading}>
          Áp dụng
        </button>
        <div className="report-presets">
          {[7, 30, 90].map((days) => (
            <button
              type="button"
              disabled={loading}
              key={days}
              onClick={() => apply(previousDay(todayVN(), days - 1), todayVN(), grain)}
            >
              {days} ngày
            </button>
          ))}
        </div>
      </form>
      {error && (
        <div className="dashboard-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setAttempt((v) => v + 1)}>Thử lại</button>
        </div>
      )}
      {exportError && (
        <p className="dashboard-error" role="alert">
          {exportError}
        </p>
      )}
      {loading ? (
        <div className="report-loading" role="status">
          Đang tổng hợp báo cáo…
        </div>
      ) : (
        report && (
          <>
            {report.isDemo && (
              <p className="report-demo" role="note">
                DEMO DATA · Dữ liệu kiểm thử riêng, không phải số liệu cửa hàng đang vận hành.
              </p>
            )}
            <div className="report-period">
              <span>
                {fullDate(report.period.from)} – {fullDate(report.period.to)} · Giờ Việt Nam (UTC+7)
              </span>
              <span>
                Cập nhật{' '}
                {new Date(report.generatedAt).toLocaleString('vi-VN', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                })}
              </span>
            </div>
            <div className="report-metrics">
              <article>
                <span>Doanh thu hoàn tất</span>
                <strong data-testid="completed-sales">
                  {reportMoney(report.metrics.completedSalesVnd)}
                </strong>
                <small>Gồm tiền hàng và phí giao hàng</small>
              </article>
              <article>
                <span>Đơn đã hoàn tất</span>
                <strong data-testid="completed-count">
                  {number(report.metrics.completedOrders)}
                </strong>
                <small>Đã giao xong và thu tiền COD</small>
              </article>
              <article>
                <span>Giá trị đơn trung bình</span>
                <strong data-testid="average-order-value">
                  {report.metrics.averageOrderValueVnd === null
                    ? '—'
                    : reportMoney(report.metrics.averageOrderValueVnd)}
                </strong>
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
                <small>
                  {number(report.metrics.placedOrders)} đơn theo ngày đặt, gồm cả đơn hủy
                </small>
              </article>
            </div>
            <div className="report-chart-panel dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <h2>
                    Doanh thu theo{' '}
                    {report.period.grain === 'day'
                      ? 'ngày'
                      : report.period.grain === 'week'
                        ? 'tuần'
                        : 'tháng'}
                  </h2>
                  <p>Tính theo ngày hoàn tất · chưa áp dụng điều chỉnh hoàn tiền</p>
                </div>
                <span className="report-currency">VND</span>
              </div>
              <SalesChart report={report} key={signature + attempt} />
            </div>
            <div className="report-bottom-grid">
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
                        {report.topVariants.map((variant) => (
                          <tr key={variant.variantId}>
                            <td>
                              <strong>{variant.productName}</strong>
                              <small>
                                {variant.sku} · {variant.variantName}
                              </small>
                            </td>
                            <td className="report-numeric">{quantities(variant.quantity)}</td>
                            <td className="report-numeric">
                              {reportMoney(variant.productSalesVnd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="report-empty">Chưa có sản phẩm bán ra từ đơn hoàn tất trong kỳ.</p>
                )}
              </section>
              <section className="dashboard-panel">
                <div className="dashboard-panel-heading">
                  <div>
                    <h2>Tồn kho cần chú ý</h2>
                    <p>{number(report.lowStockTotal)} SKU chạm ngưỡng tại thời điểm báo cáo</p>
                  </div>
                  <Link to="/admin/inventory">
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
                        {report.lowStock.map((variant) => (
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
              </section>
            </div>
            <details className="report-definitions">
              <summary>Cách tính và phạm vi báo cáo</summary>
              <ul>
                <li>
                  Doanh thu: tổng tiền đơn hoàn tất trong kỳ, gồm tiền hàng{' '}
                  {reportMoney(report.metrics.productSalesVnd)} và phí giao hàng{' '}
                  {reportMoney(report.metrics.shippingCollectedVnd)}. Đơn chưa hoàn tất hoặc đã hủy
                  không được ghi nhận.
                </li>
                <li>
                  Giá trị đơn mới đặt tính theo ngày đặt, bao gồm mọi trạng thái và không đồng nghĩa
                  với doanh thu.
                </li>
                <li>
                  AOV làm tròn đến 2 chữ số thập phân; không có đơn hoàn tất thì không áp dụng.
                </li>
                <li>
                  Tiền hàng ở bảng bán chạy không phân bổ phí vận chuyển; tên và SKU lấy từ đơn hàng
                  lịch sử.
                </li>
                <li>
                  Tuần bắt đầu thứ Hai; các kỳ đầu/cuối có thể chỉ gồm một phần tuần hoặc tháng. Kho
                  là số liệu hiện tại, không phải tồn kho lịch sử.
                </li>
                <li>
                  Chưa có nghiệp vụ hoàn tiền, lợi nhuận hoặc tỷ lệ chuyển đổi trong báo cáo này.
                  CSV lấy một bản dữ liệu mới theo kỳ đang xem.
                </li>
              </ul>
            </details>
          </>
        )
      )}
    </section>
  )
}
