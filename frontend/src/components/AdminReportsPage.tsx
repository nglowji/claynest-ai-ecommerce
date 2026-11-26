import AdminTabs from './AdminTabs'
import ReportMetrics from './ReportMetrics'
import ReportBreakdown from './ReportBreakdown'
import ReportInsights from './ReportInsights'
import ReportTrendTable from './ReportTrendTable'
import { useReports } from '../features/reports/useReports'
import { todayVN, previousDay, fullDate } from '../features/reports/utils'
import SalesChart from './SalesChart'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { reportMoney } from '../features/reports/api'
import AdminIcon from './AdminIcon'

export { default as SalesChart } from './SalesChart'

export default function AdminReportsPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const signature = new URLSearchParams(
    [...params].filter(([key]) => ['from', 'to', 'grain'].includes(key)),
  ).toString()
  const view = ['trend', 'products', 'stock'].includes(params.get('view') || '')
    ? params.get('view')!
    : 'revenue'
  const [from, setFrom] = useState(params.get('from') || previousDay(todayVN(), 29))
  const [to, setTo] = useState(params.get('to') || todayVN())
  const [grain, setGrain] = useState(params.get('grain') || 'day')
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  useEffect(() => {
    setFrom(params.get('from') || previousDay(todayVN(), 29))
    setTo(params.get('to') || todayVN())
    setGrain(params.get('grain') || 'day')
  }, [signature])
  const { report, previous, loading, comparing, error, comparisonError } = useReports(
    signature,
    attempt,
    auth.expire,
  )
  function apply(start = from, end = to, group = grain) {
    setExportError('')
    setParams(new URLSearchParams({ from: start, to: end, grain: group, view }))
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
          <h1>Báo cáo &amp; phân tích</h1>
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
            <ReportMetrics report={report} previous={previous} comparing={comparing} />
            <div className="report-comparison-period" role="status">
              {previous ? (
                <>
                  So sánh kỳ trước: {fullDate(previous.period.from)} –{' '}
                  {fullDate(previous.period.to)} · Cùng số ngày, tính theo giờ Việt Nam
                </>
              ) : (
                comparisonError || (comparing ? 'Đang tải kỳ so sánh…' : 'Chưa có kỳ so sánh')
              )}
            </div>
            <AdminTabs
              id="reports-view"
              label="Nội dung báo cáo"
              value={view}
              options={[
                { value: 'revenue', label: 'Doanh thu' },
                { value: 'trend', label: 'Xu hướng' },
                { value: 'products', label: 'Sản phẩm' },
                { value: 'stock', label: 'Cảnh báo kho' },
              ]}
              onChange={(value) => {
                const next = new URLSearchParams(params)
                next.set('view', value)
                setParams(next)
              }}
            />
            <div id="reports-view-panel" role="tabpanel" aria-labelledby={'reports-view-' + view}>
              {view === 'revenue' ? (
                <div className="reports-revenue-layout">
                  <section className="report-chart-panel dashboard-panel">
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
                        <p>Theo ngày hoàn tất · gồm tiền hàng và phí giao hàng</p>
                      </div>
                      <span className="report-currency">VND</span>
                    </div>
                    <SalesChart report={report} key={signature + attempt} showTable={false} />
                  </section>
                  <ReportInsights report={report} />
                </div>
              ) : view === 'trend' ? (
                <ReportTrendTable key={signature + attempt} report={report} />
              ) : (
                <ReportBreakdown
                  key={view + signature + attempt}
                  report={report}
                  view={view === 'products' ? 'products' : 'stock'}
                />
              )}
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
