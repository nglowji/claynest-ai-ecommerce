import SiteImage from './SiteImage'
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
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setData(null)
    setError('')
    setSelected('')
    setImage('')
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
    data.variants.find((v) => v.id === (selected || params.get('variant'))),
  )
  const variant = data.variants.find((v) => v.id === product.variantId)!
  return (
    <section className={'container product-page' + (data.sourceUrl ? ' source-detail' : '')}>
      <nav className="breadcrumbs">
        <Link to="/products">Sản phẩm</Link>
        <span>/</span>
        <span>{data.name}</span>
      </nav>
      <div className="product-detail">
        <div className="product-gallery">
          <SiteImage
            src={image || product.image}
            alt={data.images.find((i) => i.url === (image || product.image))?.alt || data.name}
          />
          <div className="product-thumbnails">
            {data.images
              .filter((i) => !i.variantId || i.variantId === variant.id)
              .map((i) => (
                <button key={i.id} onClick={() => setImage(i.url)} aria-label={'Xem ảnh ' + i.alt}>
                  <SiteImage src={i.url} alt={i.alt} />
                </button>
              ))}
          </div>
        </div>
        <div>
          <p className="eyebrow">{data.category}</p>
          <h1>{data.name}</h1>
          <ProductPrice product={product} />
          <p>{data.description}</p>
          <label className="auth-field">
            Chọn biến thể
            <select
              value={product.variantId}
              onChange={(e) => {
                setSelected(e.target.value)
                setImage('')
              }}
            >
              {data.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.glaze}
                </option>
              ))}
            </select>
          </label>
          <p>
            SKU: {variant.sku} ·{' '}
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
          <dl className="product-specs">
            {[
              ['Chất liệu', data.material],
              ['Kích thước', data.sourceDimensions],
              ['Công dụng', variant.intendedUse],
              ['Dung tích', variant.capacityMl ? `${variant.capacityMl} ml` : ''],
              ['Chiều rộng', variant.widthCm ? `${variant.widthCm} cm` : ''],
              ['Chiều cao', variant.heightCm ? `${variant.heightCm} cm` : ''],
              ['Khối lượng', variant.weightG ? `${variant.weightG} g` : ''],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {data.handmadeNote && <p className="detail-note">{data.handmadeNote}</p>}
          <h2>Câu chuyện của món gốm</h2>
          <p>{data.craftStory || 'Nàng đang chăm chút thêm câu chuyện cho món gốm này.'}</p>
          <h2>Chăm sóc & sử dụng</h2>
          {variant.careVerified ? (
            <>
              <p>{variant.careNote}</p>
              <p className="detail-note">Nguồn được quản trị xác minh: {variant.careSource}</p>
            </>
          ) : (
            <p className="detail-note">
              Vui lòng liên hệ để được hướng dẫn sử dụng và bảo quản phù hợp với thiết kế này.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
