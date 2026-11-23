import type { CatalogProduct } from '../data/products'
import SiteImage from './SiteImage'
import AdminIcon from './AdminIcon'

export default function AdminProductCell({ product }: { product: CatalogProduct }) {
  const image = product.images.find((image) => !image.variantId) || product.images[0]
  return (
    <div className="admin-product-cell">
      {image ? (
        <SiteImage
          src={image.url}
          alt={image.alt || product.name}
          loading="lazy"
          width={56}
          height={56}
        />
      ) : (
        <span className="admin-product-no-image" role="img" aria-label="Chưa có ảnh sản phẩm">
          <AdminIcon name="products" />
        </span>
      )}
      <div>
        <strong>{product.name}</strong>
        <small>
          {product.variants[0]?.sku || 'Chưa có SKU'} · {product.variants.length} biến thể
        </small>
        <small>{product.material}</small>
      </div>
    </div>
  )
}
