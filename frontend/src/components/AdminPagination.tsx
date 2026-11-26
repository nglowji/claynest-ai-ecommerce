type Props = {
  page: number
  pageSize: number
  totalCount: number
  loading?: boolean
  onPage: (page: number) => void
}

export default function AdminPagination({ page, pageSize, totalCount, loading, onPage }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = Math.max(1, Math.min(page - 1, totalPages - 2))
  const pages = Array.from(new Set([1, start, start + 1, start + 2, totalPages]))
    .filter((value) => value <= totalPages)
    .sort((a, b) => a - b)
  return (
    <nav className="admin-pagination" aria-label="Phân trang danh sách">
      <span>
        {totalCount === 0
          ? '0 kết quả'
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} / ${totalCount} kết quả`}
      </span>
      <div>
        <button disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>
          Trang trước
        </button>
        {pages.map((value, index) => (
          <span className="admin-pagination-step" key={value}>
            {index > 0 && value - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}
            <button
              aria-label={'Trang ' + value}
              aria-current={value === page ? 'page' : undefined}
              disabled={loading}
              onClick={() => onPage(value)}
            >
              {value}
            </button>
          </span>
        ))}
        <button disabled={loading || page >= totalPages} onClick={() => onPage(page + 1)}>
          Trang sau
        </button>
      </div>
    </nav>
  )
}
