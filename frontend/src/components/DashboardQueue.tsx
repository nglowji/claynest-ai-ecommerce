import { Link } from 'react-router-dom'
import type { DashboardSummary } from '../features/dashboard/useDashboard'
import AdminIcon, { type AdminIconName } from './AdminIcon'

export default function DashboardQueue({
  data,
  loading,
}: {
  data: DashboardSummary | null
  loading: boolean
}) {
  const steps: {
    label: string
    note: string
    count: number | undefined
    status: string
    icon: AdminIconName
  }[] = [
    {
      label: 'Xác nhận đơn',
      note: 'Kiểm tra đơn mới',
      count: data?.pending,
      status: 'pending',
      icon: 'clock',
    },
    {
      label: 'Chuẩn bị gốm',
      note: 'Chọn món và đóng gói',
      count: data?.confirmed,
      status: 'confirmed',
      icon: 'products',
    },
    {
      label: 'Bàn giao vận chuyển',
      note: 'Đơn đã đóng gói',
      count: data?.packed,
      status: 'packed',
      icon: 'truck',
    },
  ]
  return (
    <section className="dashboard-panel dashboard-queue" aria-labelledby="dashboard-queue-title">
      <div className="dashboard-panel-heading">
        <div>
          <h2 id="dashboard-queue-title">Công việc hôm nay</h2>
          <p>Tất cả đơn đang chờ xử lý</p>
        </div>
        <AdminIcon name="orders" />
      </div>
      <div className="dashboard-queue-list">
        {steps.map((step) => (
          <Link to={'/admin/orders?status=' + step.status} key={step.status}>
            <i>
              <AdminIcon name={step.icon} />
            </i>
            <div>
              <strong>{step.label}</strong>
              <small>{step.note}</small>
            </div>
            <b>{loading ? '…' : (step.count ?? '—')}</b>
          </Link>
        ))}
      </div>
      <div className="dashboard-queue-note">
        <AdminIcon name="check" />
        <span>
          {loading
            ? 'Đang kiểm tra công việc…'
            : !data
              ? 'Chưa có dữ liệu công việc.'
              : data.pending + data.confirmed + data.packed === 0
                ? 'Các đơn cần xử lý đã hoàn tất.'
                : 'Mở từng nhóm để tiếp tục xử lý đơn.'}
        </span>
      </div>
    </section>
  )
}
