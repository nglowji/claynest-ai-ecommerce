import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalogRequest, type PageResult } from '../catalog/api'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import AdminPagination from './AdminPagination'
type Review = {
  id: string
  authorName: string
  rating: number
  comment: string
  createdAt: string
  updatedAt: string
  verifiedPurchase: boolean
}
type Reviews = {
  totalCount: number
  averageRating: number | null
  distribution: { rating: number; count: number }[]
  reviews: PageResult<Review>
}
type Mine = { eligible: boolean; review: Review | null }
export function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="review-stars" role="img" aria-label={`${rating} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span aria-hidden="true" className={n <= Math.round(rating) ? 'filled' : ''} key={n}>
          ★
        </span>
      ))}
    </span>
  )
}
export default function ProductReviews({ productId }: { productId: string }) {
  const auth = useAuth()
  const [data, setData] = useState<Reviews | null>(null)
  const [mine, setMine] = useState<Mine | null>(null)
  const [error, setError] = useState('')
  const [mineError, setMineError] = useState('')
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [revision, setRevision] = useState(0)
  const [rating, setRating] = useState('5')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const path = `products/${productId}/reviews/`
  useEffect(() => {
    const abort = new AbortController()
    setData(null)
    setError('')
    catalogRequest<Reviews>(
      path +
        '?' +
        new URLSearchParams({ page: String(page), ...(filter ? { rating: filter } : {}) }),
      { signal: abort.signal },
    )
      .then((value) => {
        if (!abort.signal.aborted) setData(value)
      })
      .catch(() => {
        if (!abort.signal.aborted) setError('Chưa tải được đánh giá. Vui lòng thử lại.')
      })
    return () => abort.abort()
  }, [productId, page, filter, revision])
  useEffect(() => {
    const abort = new AbortController()
    setMine(null)
    setMineError('')
    setSaveError('')
    setComment('')
    setRating('5')
    if (auth.user)
      catalogRequest<Mine>(path + 'mine', { signal: abort.signal })
        .then((value) => {
          if (!abort.signal.aborted) {
            setMine(value)
            if (value.review) {
              setRating(String(value.review.rating))
              setComment(value.review.comment)
            }
          }
        })
        .catch((failure) => {
          if (!abort.signal.aborted) {
            if (failure instanceof AuthError && failure.status === 401) auth.expire()
            setMineError('Chưa kiểm tra được quyền đánh giá.')
          }
        })
    return () => abort.abort()
  }, [productId, auth.user?.id, revision])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !mine?.eligible) return
    setBusy(true)
    setSaveError('')
    setNotice('')
    try {
      await catalogRequest<Review>(path + 'mine', {
        method: 'PUT',
        body: JSON.stringify({ rating: Number(rating), comment }),
      })
      setRevision((value) => value + 1)
      setPage(1)
      setFilter('')
      setNotice('Đã lưu đánh giá của bạn. Cảm ơn bạn đã chia sẻ!')
    } catch (failure) {
      if (failure instanceof AuthError && failure.status === 401) auth.expire()
      setSaveError(failure instanceof Error ? failure.message : 'Chưa lưu được đánh giá.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section
      className="product-reviews"
      id="product-reviews"
      aria-labelledby="product-reviews-title"
    >
      <div className="product-reviews-heading">
        <div>
          <p className="eyebrow">GÓC CHIA SẺ</p>
          <h2 id="product-reviews-title">Đánh giá từ người mua</h2>
        </div>
        {data && <span>{data.totalCount} đánh giá</span>}
      </div>
      <div className="product-reviews-layout">
        <div>
          {data && (
            <div className="reviews-summary">
              <div>
                <strong>
                  {data.averageRating?.toLocaleString('vi-VN') || '—'}
                  <small> / 5</small>
                </strong>
                <ReviewStars rating={data.averageRating || 0} />
                <p>{data.totalCount ? 'Từ đơn hàng đã hoàn tất' : 'Chưa có đánh giá'}</p>
              </div>
              <div className="reviews-distribution">
                {data.distribution.map((row) => (
                  <div key={row.rating}>
                    <span>{row.rating} sao</span>
                    <meter
                      min={0}
                      max={Math.max(1, data.totalCount)}
                      value={row.count}
                      aria-label={`${row.rating} sao: ${row.count} đánh giá`}
                    />
                    <span>{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <label className="review-filter">
            Lọc đánh giá
            <select
              aria-label="Lọc đánh giá"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả số sao</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} sao
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p role="alert">
              {error} <button onClick={() => setRevision((v) => v + 1)}>Thử lại đánh giá</button>
            </p>
          ) : !data ? (
            <p role="status">Đang tải đánh giá…</p>
          ) : (
            <>
              {data.reviews.items.map((review) => (
                <article className="buyer-review" key={review.id}>
                  <header>
                    <div>
                      <strong>{review.authorName}</strong>
                      {review.verifiedPurchase && <span>Đã mua hàng</span>}
                    </div>
                    <time dateTime={review.createdAt}>
                      {new Date(review.createdAt).toLocaleDateString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      })}
                    </time>
                  </header>
                  <ReviewStars rating={review.rating} />
                  <p>{review.comment}</p>
                  {review.updatedAt !== review.createdAt && <small>Đã chỉnh sửa</small>}
                </article>
              ))}
              {!data.reviews.items.length && (
                <p className="review-empty">
                  {filter
                    ? 'Chưa có đánh giá với số sao này.'
                    : 'Hãy chia sẻ cảm nhận sau khi nhận được món gốm của bạn.'}
                </p>
              )}
              <AdminPagination
                page={page}
                pageSize={5}
                totalCount={data.reviews.totalCount}
                onPage={setPage}
              />
            </>
          )}
        </div>
        <aside className="review-compose">
          <h3>{mine?.review ? 'Chỉnh sửa đánh giá của bạn' : 'Chia sẻ cảm nhận'}</h3>
          {notice && (
            <p className="auth-success" role="status">
              {notice}
            </p>
          )}
          {saveError && (
            <p className="auth-error" role="alert">
              {saveError}
            </p>
          )}
          {auth.status === 'loading' ? (
            <p>Đang kiểm tra tài khoản…</p>
          ) : !auth.user ? (
            <p>
              <Link to="/login">Đăng nhập</Link> để đánh giá sản phẩm đã mua.
            </p>
          ) : mineError ? (
            <p role="alert">
              {mineError} <button onClick={() => setRevision((v) => v + 1)}>Thử lại</button>
            </p>
          ) : !mine ? (
            <p role="status">Đang kiểm tra đơn hàng…</p>
          ) : !mine.eligible ? (
            <p>Bạn có thể đánh giá khi đơn hàng chứa sản phẩm này đã hoàn tất.</p>
          ) : (
            <form onSubmit={submit}>
              <fieldset disabled={busy}>
                <label>
                  Điểm đánh giá
                  <select
                    aria-label="Điểm đánh giá"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} sao
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nội dung đánh giá
                  <textarea
                    aria-label="Nội dung đánh giá"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={5}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Cảm nhận của bạn về chất men, kiểu dáng và trải nghiệm sử dụng…"
                  />
                </label>
                <small>
                  Tên hiển thị sẽ được rút gọn. Nội dung đánh giá được hiển thị công khai.
                </small>
                <button className="button primary" type="submit">
                  {busy ? 'Đang lưu…' : mine.review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
                </button>
              </fieldset>
            </form>
          )}
        </aside>
      </div>
    </section>
  )
}
