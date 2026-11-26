import ProductGallery from './ProductGallery'
import ProductFacts from './ProductFacts'
import ProductReviews from './ProductReviews'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { catalogRequest } from '../catalog/api'
import { productView, type CatalogProduct } from '../data/products'
import { AuthError } from '../auth/api'
import ProductPrice from './ProductPrice'
import type { ProductActions } from './ProductGrid'

export default function ProductPage({ onAdd }: ProductActions) {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState<CatalogProduct | null>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setData(null)
    setError('')
    setSelected('')
    catalogRequest<CatalogProduct>('products/' + encodeURIComponent(slug || ''), {
      signal: abort.signal,
    })
      .then((p) => {
        if (!abort.signal.aborted) {
          setData(p)
          document.title = p.name + ' | Nàng Gốm'
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof AuthError && e.status === 404
              ? 'Sản phẩm không còn được giới thiệu.'
              : 'Chưa tải được sản phẩm.',
          )
      })
    return () => abort.abort()
  }, [slug, attempt])
  if (error)
    return (
      <section className="container empty-state">
        <h1>{error}</h1>
        <button onClick={() => setAttempt((v) => v + 1)}>Thử lại</button>
        <Link to="/products">Ghé xem sản phẩm khác</Link>
      </section>
    )
  if (!data)
    return (
      <section className="container account-page" role="status">
        Đang tải món gốm…
      </section>
    )
  const product = productView(
    data,
    data.variants.find((v) => v.active && v.id === (selected || params.get('variant'))),
  )
  const variant = data.variants.find((v) => v.id === product.variantId)!
  return (
    <section
      className={
        'container product-page product-page-v2' + (data.sourceUrl ? ' source-detail' : '')
      }
    >
      <nav className="breadcrumbs">
        <Link to="/products">Sản phẩm</Link>
        <span>/</span>
        <span>{data.name}</span>
      </nav>
      <div className="product-detail">
        <ProductGallery
          key={data.id}
          images={data.images.filter((i) => !i.variantId || i.variantId === variant.id)}
          initial={product.image}
          name={data.name}
        />
        <div className="product-purchase-panel">
          <p className="eyebrow">{data.category}</p>
          <h1>{data.name}</h1>
          <a className="product-review-jump" href="#product-reviews">
            Xem đánh giá từ người mua ↓
          </a>
          <ProductPrice product={product} />
          <p>{data.description}</p>
          <label className="auth-field">
            Chọn biến thể
            <select
              value={product.variantId}
              onChange={(e) => {
                setSelected(e.target.value)
              }}
            >
              {data.variants
                .filter((v) => v.active)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.glaze}
                  </option>
                ))}
            </select>
          </label>
          <p>
            Mã sản phẩm: {variant.sku} ·{' '}
            {variant.stockQty > 0
              ? `Còn ${variant.stockQty} sản phẩm`
              : data.sourceUrl
                ? 'Liên hệ xác nhận số lượng'
                : 'Tạm hết hàng'}
          </p>
          {!variant.stockQty && data.sourceUrl ? (
            <a
              className="button primary"
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Xem tại {data.sourceName} ↗
            </a>
          ) : (
            <button
              className="button primary"
              disabled={!variant.stockQty}
              onClick={() => onAdd(product)}
            >
              {variant.stockQty ? 'Thêm vào giỏ' : 'Tạm hết hàng'}
            </button>
          )}
          <ProductFacts product={data} variant={variant} />
        </div>
      </div>
      <ProductReviews key={data.id} productId={data.id} />
    </section>
  )
}
