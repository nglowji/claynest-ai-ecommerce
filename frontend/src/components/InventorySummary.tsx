import { useEffect, useState } from 'react'
import { catalogRequest, type PageResult } from '../catalog/api'
export default function InventorySummary({
  revision,
  lowOnly,
  onFilter,
}: {
  revision: number
  lowOnly: boolean
  onFilter: (low: boolean) => void
}) {
  const [counts, setCounts] = useState<{ all: number; low: number } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setCounts(null)
    setError(false)
    Promise.all([
      catalogRequest<PageResult<unknown>>('admin/inventory/?pageSize=1', {
        signal: controller.signal,
      }),
      catalogRequest<PageResult<unknown>>('admin/inventory/?lowOnly=true&pageSize=1', {
        signal: controller.signal,
      }),
    ])
      .then(([all, low]) => {
        if (!controller.signal.aborted) setCounts({ all: all.totalCount, low: low.totalCount })
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
    return () => controller.abort()
  }, [revision])
  return (
    <section className="inventory-summary" aria-label="Tổng quan kho">
      <button aria-pressed={!lowOnly} onClick={() => onFilter(false)}>
        <span>Toàn bộ mã hàng</span>
        <strong>{counts?.all.toLocaleString('vi-VN') ?? '—'}</strong>
        <small>Xem toàn bộ tồn kho</small>
      </button>
      <button aria-pressed={lowOnly} onClick={() => onFilter(true)}>
        <span>Cần bổ sung hàng</span>
        <strong>{counts?.low.toLocaleString('vi-VN') ?? '—'}</strong>
        <small>Bao gồm mã đã hết hàng</small>
      </button>
      <div>
        <strong>10 mã / trang</strong>
        <p>Chọn biểu tượng sửa để nhập kho, kiểm kê và xem lịch sử từng mã.</p>
        {error && <p role="status">Chưa tải được tổng kho. Chọn tải lại dữ liệu để thử lại.</p>}
      </div>
    </section>
  )
}
