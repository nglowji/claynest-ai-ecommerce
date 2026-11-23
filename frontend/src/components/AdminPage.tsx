import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const period = dashboardPeriod(params.get('days'))
  const { summary, report, query, refresh } = useDashboard(period, auth.expire)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  async function logout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError('Chưa thể đăng xuất. Vui lòng thử lại.')
      setLoggingOut(false)
    }
  }
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
          <button onClick={refresh} disabled={summary.loading || report.loading}>
            <AdminIcon name="refresh" />
            Làm mới
          </button>
          <button className="logout-button" onClick={logout} disabled={loggingOut}>
            <AdminIcon name="logout" />
            {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
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
      {logoutError && (
        <p className="dashboard-error" role="alert">
          {logoutError}
        </p>
      )}
      {summary.error && (
        <div className="dashboard-error" role="alert">
          {summary.error}
          <button onClick={refresh}>Thử lại hoạt động</button>
        </div>
      )}
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
          </div>
          <RevenueMetrics report={report.data} loading={report.loading} />
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
      <DashboardOrders
        recent={summary.data?.recent || []}
        loading={summary.loading}
        error={summary.error}
        revision={summary.updatedAt?.toISOString() || ''}
      />
      {report.data && !report.loading && (
        <DashboardInsights report={report.data} reportUrl={reportUrl} />
      )}
      <footer className="dashboard-footer">
        <span>Nàng Gốm · Chăm chút cửa hàng mỗi ngày</span>
        <Link to="/">
          Mở trang bán hàng <AdminIcon name="external" />
        </Link>
      </footer>
    </section>
  )
}
