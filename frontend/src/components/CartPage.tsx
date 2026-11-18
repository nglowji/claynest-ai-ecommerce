import { Link } from 'react-router-dom'
import Icon from './Icon'
import ProductPrice from './ProductPrice'
import { money, type Product } from '../data/products'

type Props = { items: Product[]; quantities: Record<string, number>; onChange: (id: string, delta: number) => void; onRemove: (id: string) => void }
export default function CartPage({ items, quantities, onChange, onRemove }: Props) {
  const selected = items.filter(p => quantities[p.variantId])
  const count = selected.reduce((n,p) => n + quantities[p.variantId], 0)
  const total = selected.reduce((n,p) => n + p.price * quantities[p.variantId], 0)
  return <section className="basket-page compact-basket container" aria-labelledby="basket-title"><nav className="breadcrumbs" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><span>Giỏ hàng</span></nav><div className="basket-heading"><div><h1 id="basket-title">Giỏ hàng <span className="basket-count">({count})</span></h1></div><Link className="text-link" to="/products">Tiếp tục mua sắm <Icon name="arrow" /></Link></div>
  {count ? <div className="basket-layout"><div><div className="basket-list-heading"><span>Sản phẩm đã chọn</span><span>{count} món gốm</span></div><ul className="basket-items">{selected.map(p => <li key={p.variantId}><Link to={'/products/' + p.slug}><img src={p.image} alt={p.name} /></Link><div className="basket-item-info"><Link to={'/products/' + p.slug}><h2>{p.name}</h2></Link><ProductPrice product={p} /><div className="quantity"><button aria-label={`Giảm số lượng ${p.name}`} onClick={() => onChange(p.variantId,-1)}><Icon name="minus" /></button><span>{quantities[p.variantId]}</span><button disabled={quantities[p.variantId] >= p.stockQty} aria-label={`Tăng số lượng ${p.name}`} onClick={() => onChange(p.variantId,1)}><Icon name="plus" /></button></div></div><div className="basket-line-end"><button className="icon-button" aria-label={`Xóa ${p.name}`} onClick={() => onRemove(p.variantId)}><Icon name="close" /></button><strong>{money(p.price * quantities[p.variantId])}</strong></div></li>)}</ul><p className="basket-note"><Icon name="leaf" /> Sản phẩm trong giỏ chưa được giữ hàng.</p></div><aside className="basket-summary"><h2>Tóm tắt giỏ hàng</h2><div><span>Tạm tính ({count} sản phẩm)</span><strong>{money(total)}</strong></div><div><span>Phí giao hàng</span><span>Chưa tính</span></div><div className="basket-grand"><span>Tổng tạm tính</span><strong>{money(total)}</strong></div><p>Thanh toán trực tuyến hiện chưa mở.</p><Link className="button primary" to="/products">Tiếp tục khám phá <Icon name="arrow" /></Link></aside></div> : <div className="basket-empty"><Icon name="bag" /><h2>Giỏ hàng đang trống</h2><p>Chọn một món gốm bạn yêu để bắt đầu.</p><Link className="button primary" to="/products">Khám phá sản phẩm <Icon name="arrow" /></Link></div>}

  </section>
}
