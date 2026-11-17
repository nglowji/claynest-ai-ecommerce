import Icon from './Icon'
import { money, type Product } from '../data/products'

export type ProductActions = { onAdd: (product: Product) => void; onShow: (product: Product) => void }

export default function ProductGrid({ items, onAdd, onShow }: ProductActions & { items: Product[] }) {
  return <div className="product-grid">{items.map(product => <article className="product-card" key={product.id}>
    <button className="product-image-button" onClick={() => onShow(product)} aria-label={`Xem ${product.name}`}>
      <img src={product.image} alt={product.name} loading="lazy" width="1254" height="1254" />
      <span className="quick-view">Xem gần hơn <Icon name="arrow" /></span>
    </button>
    <div className="product-info"><div><p className="product-note">{product.note}</p>
      <h3><button onClick={() => onShow(product)}>{product.name}</button></h3><p className="price">{money(product.price)}</p>
    </div><button className="add-button" onClick={() => onAdd(product)} aria-label={`Thêm ${product.name} vào giỏ minh họa`}><Icon name="plus" /></button></div>
  </article>)}</div>
}

