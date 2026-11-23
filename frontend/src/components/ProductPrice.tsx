import { money, isOnSale, type Product } from '../data/products'

export default function ProductPrice({ product }: { product: Product }) {
  return (
    <div className={isOnSale(product) ? 'product-pricing on-sale' : 'product-pricing'}>
      <span className="current-price">
        <span className="sr-only">{isOnSale(product) ? 'Giá ưu đãi: ' : 'Giá: '}</span>
        {money(product.price)}
        {product.priceUnit && (
          <small className="price-unit"> / {product.priceUnit.toLowerCase()}</small>
        )}
      </span>
      {isOnSale(product) && (
        <del className="original-price">
          <span className="sr-only">Giá gốc: </span>
          {money(product.originalPrice!)}
        </del>
      )}
    </div>
  )
}
