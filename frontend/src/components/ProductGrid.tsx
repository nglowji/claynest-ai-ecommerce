import SiteImage from './SiteImage'
import Icon from './Icon'
import ProductPrice from './ProductPrice'
import { discountPercent, isOnSale, type Product } from '../data/products'

export type ProductActions = { onAdd: (product: Product) => void; onShow: (product: Product) => void }

export default function ProductGrid({ items, onAdd, onShow }: ProductActions & { items: Product[] }) {
  return <div className="product-grid">{items.map(product => <article className={'product-card shop-product-card' + (product.sourceUrl ? ' source-product' : '')} key={product.id}>
    <div className="shop-product-visual"><button className="product-image-button" onClick={() => onShow(product)} aria-label={`Xem ${product.name}`}>
      <SiteImage src={product.image} alt={product.name} loading="lazy" width="1254" height="1254" />
      <span className="quick-view">Xem gần hơn <Icon name="arrow" /></span>
    </button><div className="product-stickers">{product.label && <span className={product.label === 'HOT SALE' ? 'product-label hot' : 'product-label'}>{product.label}</span>}{isOnSale(product) && <span className="discount-label" aria-label={`Giảm ${discountPercent(product)} phần trăm`}>−{discountPercent(product)}%</span>}</div></div>
    <div className="shop-product-body"><p className="product-note">{product.note}</p><h3><button onClick={() => onShow(product)}>{product.name}</button></h3><ProductPrice product={product} />
      <button className="product-add" disabled={!product.stockQty && !product.sourceUrl} onClick={() => product.stockQty ? onAdd(product) : onShow(product)} aria-label={`Thêm ${product.name} vào giỏ`}>{product.stockQty ? 'Thêm vào giỏ' : product.sourceUrl ? 'Xem sản phẩm' : 'Tạm hết hàng'} <Icon name="plus" /></button>
    </div>
  </article>)}</div>
}
