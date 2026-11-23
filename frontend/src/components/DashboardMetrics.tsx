import { Link } from 'react-router-dom'
import { reportMoney, type SalesReport } from '../features/reports/api'
import type { DashboardSummary } from '../features/dashboard/useDashboard'
import AdminIcon, { type AdminIconName } from './AdminIcon'

type Props = { summary: DashboardSummary | null; loading: boolean }
export function OperationMetrics({ summary, loading }: Props) {
  const cards: {
    title: string
    value: number | undefined
    note: string
    url: string
    icon: AdminIconName
  }[] = [
    {
      title: 'Tổng sản phẩm',
      value: summary?.products,
      note: 'Toàn bộ danh mục quản trị',
      url: '/admin/products',
      icon: 'products',
    },
    {
      title: 'Chờ xác nhận',
      value: summary?.pending,
      note: 'Cần kiểm tra và xác nhận',
      url: '/admin/orders?status=pending',
      icon: 'clock',
    },
    {
      title: 'Đang giao hàng',
      value: summary?.shipped,
      note: 'Đã bàn giao vận chuyển',
      url: '/admin/orders?status=shipped',
      icon: 'truck',
    },
    {
      title: 'Kho cần chú ý',
      value: summary?.lowStock,
      note: 'SKU chạm ngưỡng cảnh báo',
      url: '/admin/inventory?lowOnly=true',
      icon: 'inventory',
    },
  ]
  return (
    <div className="dashboard-metrics" aria-busy={loading}>
      {cards.map((card) => (
        <Link className="dashboard-metric" key={card.title} to={card.url}>
          <div>
            <span>{card.title}</span>
            <i>
              <AdminIcon name={card.icon} />
            </i>
          </div>
          <strong>{loading ? '…' : (card.value?.toLocaleString('vi-VN') ?? '—')}</strong>
          <p>{card.note}</p>
        </Link>
      ))}
    </div>
  )
}

export function RevenueMetrics({
  report,
  loading,
}: {
  report: SalesReport | null
  loading: boolean
}) {
  const metrics = report?.metrics
  const cells = [
    {
      label: 'Doanh thu hoàn tất',
      value: metrics ? reportMoney(metrics.completedSalesVnd) : null,
      note: 'Gồm phí giao hàng đã thu',
    },
    {
      label: 'Đơn hoàn tất',
      value: metrics?.completedOrders.toLocaleString('vi-VN'),
      note: 'Theo ngày hoàn tất trong kỳ',
    },
    {
      label: 'Giá trị đơn trung bình',
      value: metrics?.averageOrderValueVnd ? reportMoney(metrics.averageOrderValueVnd) : null,
      note: 'Tính trên đơn hoàn tất',
    },
    {
      label: 'Đơn đặt mới',
      value: metrics?.placedOrders.toLocaleString('vi-VN'),
      note: 'Gồm cả đơn đã hủy trong kỳ',
    },
  ]
  return (
    <div className="dashboard-revenue-metrics" aria-busy={loading}>
      {cells.map((cell) => (
        <div key={cell.label}>
          <span>{cell.label}</span>
          <strong>{loading ? '…' : (cell.value ?? '—')}</strong>
          <small>{cell.note}</small>
        </div>
      ))}
    </div>
  )
}
