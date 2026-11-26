import AdminPagination from './AdminPagination'
import type { PageResult } from '../catalog/api'
export type StockMovement = {
  id: string
  kind: string
  quantityDelta: number
  balanceAfter: number
  thresholdAfter: number
  reason: string
  actorName: string
  createdAt: string
}
const kindNames: Record<string, string> = {
  restock: 'Hoàn kho khi hủy',
  sale: 'Đặt hàng',
  opening: 'Số dư đầu kỳ',
  receipt: 'Nhập kho',
  adjustment: 'Điều chỉnh',
  threshold: 'Đổi ngưỡng cảnh báo',
}
export default function InventoryHistory({
  history,
  historyError,
  historyPage,
  setHistoryPage,
  retry,
}: {
  history: PageResult<StockMovement> | null
  historyError: string
  historyPage: number
  setHistoryPage: (value: number) => void
  retry: () => void
}) {
  return (
    <div className="inventory-history">
      <h3>Lịch sử kho</h3>
      {historyError ? (
        <p role="alert">
          {historyError} <button onClick={() => retry()}>Thử lại</button>
        </p>
      ) : !history ? (
        <p role="status">Đang tải lịch sử…</p>
      ) : (
        <>
          <ol>
            {history.items.map((m) => (
              <li key={m.id}>
                <div>
                  <strong>{kindNames[m.kind] || m.kind}</strong>
                  <span>
                    {m.quantityDelta > 0 ? '+' : ''}
                    {m.quantityDelta} · Tồn {m.balanceAfter}
                  </span>
                </div>
                <p>{m.reason}</p>
                <small>
                  {m.actorName} ·{' '}
                  {new Date(m.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                </small>
                {m.kind === 'threshold' && <small>Ngưỡng: {m.thresholdAfter}</small>}
              </li>
            ))}
          </ol>
          {history.totalCount === 0 && <p>Chưa có thay đổi kho.</p>}
          <AdminPagination
            page={historyPage}
            pageSize={history.pageSize}
            totalCount={history.totalCount}
            onPage={setHistoryPage}
          />
        </>
      )}
    </div>
  )
}
