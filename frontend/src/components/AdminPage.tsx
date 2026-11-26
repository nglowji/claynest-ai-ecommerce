import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { dashboardPeriod, useDashboard } from '../features/dashboard/useDashboard'
import { OperationMetrics, RevenueMetrics } from './DashboardMetrics'
import DashboardOrders from './DashboardOrders'
import DashboardQueue from './DashboardQueue'
import DashboardInsights from './DashboardInsights'
import { SalesChart } from './AdminReportsPage'
import AdminIcon from './AdminIcon'

export default function AdminPage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const period = dashboardPeriod(params.get('days'))
  const { summary, report, query, refresh } = useDashboard(period, auth.expire)
  const reportUrl = '/admin/reports?' + query
  return (
    <section className="admin-dashboard dashboard-v2">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">NÀNG GỐM · TỔNG QUAN</p>
          <h1>Tổng quan cửa hàng</h1>
          <p className="dashboard-description">Một góc nhìn rõ ràng, cho mỗi ngày vận hành.</p>
        </div>
        <div className="dashboard-heading-actions">
          <label className="dashboard-period">
            <span>Kỳ thống kê</span>
            <select
              aria-label="Kỳ thống kê dashboard"
              value={period}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                next.set('days', e.target.value)
                setParams(next)
              }}
            >
              <option value="7">7 ngày gần nhất</option>
              <option value="30">30 ngày gần nhất</option>
              <option value="90">90 ngày gần nhất</option>
            </select>
          </label>
          <Link className="admin-ai-entry" to="/admin/assistant">
            <AdminIcon name="assistant" />
            Hỏi trợ lý
          </Link>
          <button onClick={refresh} disabled={summary.loading || report.loading}>
            <AdminIcon name="refresh" />
            Làm mới
          </button>
        </div>
      </div>
      <div className="dashboard-context">
        <span>
          <AdminIcon name="clock" />
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          })}
        </span>
        <span>
          {summary.loading
            ? 'Đang cập nhật hoạt động…'
            : summary.updatedAt
              ? 'Cập nhật lúc ' +
                summary.updatedAt.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Ho_Chi_Minh',
                })
              : 'Chưa cập nhật được hoạt động'}
        </span>
      </div>
      {summary.error && (
        <div className="dashboard-error" role="alert">
          {summary.error}
          <button onClick={refresh}>Thử lại hoạt động</button>
        </div>
      )}
      <section className="dashboard-business-summary" aria-label="Kết quả kinh doanh">
        <p className="admin-section-caption">KẾT QUẢ KINH DOANH · {period} NGÀY</p>
        <RevenueMetrics report={report.data} loading={report.loading} />
      </section>
      <p className="admin-section-caption">HOẠT ĐỘNG CỬA HÀNG · HIỆN TẠI</p>
      <OperationMetrics summary={summary.data} loading={summary.loading} />
      <div className="dashboard-overview-grid">
        <section
          className="dashboard-panel dashboard-sales"
          aria-labelledby="dashboard-sales-title"
        >
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-section-label">HIỆU QUẢ KINH DOANH</p>
              <h2 id="dashboard-sales-title">Doanh thu cửa hàng</h2>
            </div>
          </div>
          {report.loading ? (
            <p className="dashboard-chart-loading" role="status">
              Đang tải doanh thu…
            </p>
          ) : report.error ? (
            <div className="dashboard-empty" role="alert">
              <p>{report.error}</p>
              <button onClick={refresh}>Thử lại doanh thu</button>
            </div>
          ) : (
            report.data && <SalesChart key={query} report={report.data} />
          )}
          <div className="dashboard-sales-footer">
            <span>
              Theo ngày hoàn tất · Giờ Việt Nam{report.data?.isDemo ? ' · Dữ liệu DEMO' : ''}
            </span>
            <Link to={reportUrl}>Báo cáo chi tiết</Link>
          </div>
        </section>
        <DashboardQueue data={summary.data} loading={summary.loading} />
      </div>
      <div className="dashboard-detail-grid">
        <DashboardOrders
          recent={summary.data?.recent || []}
          loading={summary.loading}
          error={summary.error}
          revision={summary.updatedAt?.toISOString() || ''}
        />
        {report.data && !report.loading && (
          <DashboardInsights report={report.data} reportUrl={reportUrl} />
        )}
      </div>
      <footer className="dashboard-footer">
        <span>Nàng Gốm · Chăm chút cửa hàng mỗi ngày</span>
        <Link to="/">
          Mở trang bán hàng <AdminIcon name="external" />
        </Link>
      </footer>
    </section>
  )
}
