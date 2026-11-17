import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import Icon from './components/Icon'
import { categories, products, money, normalize, type Category, type Product } from './data/products'

type Cart = Record<number, number>
type ProductActions = { onAdd: (product: Product) => void; onShow: (product: Product) => void }

function ProductGrid({ items, onAdd, onShow }: ProductActions & { items: Product[] }) {
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

function HomePage(actions: ProductActions) {
  return <>
    <section className="banner" aria-labelledby="hero-title">
      <img src="/images/slow-living/banner-wide.jpg" alt="Gốm mộc và cành olive trên bàn gỗ bên cửa sổ ngập nắng" fetchPriority="high" width="2172" height="724" />
      <div className="banner-shade" />
      <div className="banner-content container"><p className="eyebrow">GỐM MỘC CHO TỔ ẤM</p>
        <h1 id="hero-title">Chậm một nhịp.<br />Chạm <em>bình yên.</em></h1>
        <p>Một tách trà, một nhành hoa.<br />Một chút an yên cho mỗi ngày.</p>
        <Link className="button primary" to="/products">Khám phá gốm <Icon name="arrow" /></Link>
      </div>
    </section>
    <section className="products-section container" aria-labelledby="featured-title">
      <div className="section-heading"><div><p className="eyebrow">DÀNH CHO NHỮNG NGÀY THẢNH THƠI</p><h2 id="featured-title">Gốm cho <em>mỗi ngày.</em></h2></div>
        <Link className="text-link" to="/products">Xem tất cả <Icon name="arrow" /></Link>
      </div>
      <ProductGrid items={products.slice(0, 4)} {...actions} />
    </section>
    <section id="story" className="story-section container" aria-labelledby="story-title">
      <div className="story-image"><img src="/images/slow-living/artisan.jpg" alt="Đôi bàn tay tạo hình bát gốm trên bàn xoay — ảnh AI minh họa" loading="lazy" width="1536" height="1024" /></div>
      <div className="story-copy"><p className="eyebrow">CHUYỆN CỦA CLAYNEST</p><h2 id="story-title">Từ đất mộc,<br />đến một góc <em>bình yên.</em></h2>
        <p>Một vệt men ngẫu hứng. Một đường cong rất riêng. Những điều nhỏ khiến ta muốn nâng niu một món gốm lâu hơn.</p>
        <p>ClayNest là lời mời dành thời gian cho những điều gần gũi — một tách trà, một góc nhà, một người mình thương.</p>
        <Link className="text-link" to="/products">Chọn món gốm của bạn <Icon name="arrow" /></Link>
      </div>
    </section>
  </>
}

function ProductsPage(actions: ProductActions) {
  const [params, setParams] = useSearchParams()
  const input = useRef<HTMLInputElement>(null)
  const category = categories.includes(params.get('category') as Category) ? params.get('category') as Category : 'Tất cả'
  const query = params.get('q') || ''
  const sort = params.get('sort') || 'default'
  const visible = products.filter(product => (category === 'Tất cả' || product.category === category) && normalize(`${product.name} ${product.note} ${product.category}`).includes(normalize(query.trim())))
  if (sort === 'price-asc') visible.sort((a, b) => a.price - b.price || a.id - b.id)
  if (sort === 'price-desc') visible.sort((a, b) => b.price - a.price || a.id - b.id)
  const focusSearch = params.get('search') === '1'
  useEffect(() => { if (focusSearch) input.current?.focus() }, [focusSearch])
  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value && value !== 'Tất cả' && value !== 'default') next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key === 'q' })
  }
  return <section className="catalog-page container" aria-labelledby="catalog-title">
    <nav className="breadcrumbs" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Tất cả sản phẩm</span></nav>
    <div className="catalog-heading"><p className="eyebrow">CỬA HÀNG CLAYNEST</p><h1 id="catalog-title">Tất cả <em>sản phẩm.</em></h1><p>Tìm một món gốm hợp với góc nhỏ của bạn.</p></div>
    <div className="catalog-controls">
      <div className="search-panel"><Icon name="search" /><input ref={input} value={query} onChange={event => update('q', event.target.value)} placeholder="Tìm món gốm bạn yêu…" aria-label="Tìm kiếm sản phẩm" />
        {query && <button className="icon-button" aria-label="Xóa tìm kiếm" onClick={() => update('q', '')}><Icon name="close" /></button>}
      </div>
      <label className="sort-control"><span>Sắp xếp</span><select value={sort} onChange={event => update('sort', event.target.value)}><option value="default">Mặc định</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label>
    </div>
    <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label="Lọc theo danh mục">{categories.map(item => <button key={item} className={category === item ? 'category-tab active' : 'category-tab'} aria-pressed={category === item} onClick={() => update('category', item)}>{item}</button>)}</div><span className="result-count" role="status">{visible.length} sản phẩm</span></div>
    <ProductGrid items={visible} {...actions} />
    {!visible.length && <div className="empty-state"><h2>Chưa tìm thấy món gốm phù hợp</h2><p>Thử một từ khóa hoặc danh mục khác nhé.</p><button className="button primary" onClick={() => setParams({})}>Xem tất cả sản phẩm</button></div>}
  </section>
}

export default function App() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cart, setCart] = useState<Cart>({})
  const [selected, setSelected] = useState<Product | null>(null)
  const [overlay, setOverlay] = useState<'product' | 'cart' | null>(null)
  const [notice, setNotice] = useState('')
  const modal = useRef<HTMLDialogElement>(null)
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  const total = products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0)
  useEffect(() => {
    if (overlay) { modal.current?.showModal(); document.body.style.overflow = 'hidden' }
    else { modal.current?.close(); document.body.style.overflow = '' }
    return () => { document.body.style.overflow = '' }
  }, [overlay])
  useEffect(() => {
    setMenuOpen(false)
    if (location.hash) {
      const id = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView())
      return () => cancelAnimationFrame(id)
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname, location.hash])
  useEffect(() => {
    document.title = location.pathname === '/products' ? 'Tất cả sản phẩm | ClayNest' : 'ClayNest | Gốm & những điều an yên'
  }, [location.pathname])
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 3000); return () => window.clearTimeout(id) }, [notice])
  function add(product: Product) {
    setCart(current => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))
    setNotice(`Đã thêm ${product.name} vào giỏ minh họa`)
  }
  function change(id: number, delta: number) {
    setCart(current => { const next = { ...current }; next[id] = Math.max(0, (next[id] || 0) + delta); if (!next[id]) delete next[id]; return next })
  }
  function showProduct(product: Product) { setSelected(product); setOverlay('product') }
  const actions = { onAdd: add, onShow: showProduct }
  return <>
    <a className="skip-link" href="#main">Đến nội dung chính</a>
    <header className="site-header"><div className="header-inner container">
      <Link className="brand" to="/" aria-label="ClayNest — Trang chủ"><span className="brand-mark"><Icon name="leaf" /></span>claynest<span className="brand-dot">.</span></Link>
      <nav id="mobile-nav" className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Điều hướng chính">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-active' : ''}>Trang chủ</NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'nav-active' : ''}>Sản phẩm</NavLink>
        <Link to="/#story" onClick={() => setMenuOpen(false)}>Về ClayNest</Link>
      </nav>
      <div className="header-actions"><Link className="icon-button" aria-label="Tìm kiếm sản phẩm" to="/products?search=1"><Icon name="search" /></Link>
        <button className="icon-button bag-button" aria-label={`Giỏ hàng, ${count} sản phẩm`} onClick={() => setOverlay('cart')}><Icon name="bag" /><span className="bag-count">{count}</span></button>
        <button className="icon-button menu-button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
    </div></header>
    <main id="main"><Routes>
      <Route path="/" element={<HomePage {...actions} />} />
      <Route path="/products" element={<ProductsPage {...actions} />} />
      <Route path="*" element={<section className="container empty-state not-found"><h1>Không tìm thấy trang</h1><Link className="button primary" to="/">Về trang chủ <Icon name="arrow" /></Link></section>} />
    </Routes></main>
    <footer className="site-footer"><div className="container footer-main"><div className="footer-brand"><Link className="brand" to="/">claynest<span className="brand-dot">.</span></Link><p>Gốm mộc. Nhà ấm. Ngày an yên.</p></div><nav className="footer-links" aria-label="Liên kết cuối trang"><Link to="/products">Tất cả sản phẩm</Link><Link to="/#story">Về ClayNest</Link></nav></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} ClayNest</span><span>Bản minh họa · Ảnh AI, giá tham khảo · Chưa nhận đơn hàng</span></div></footer>
    <div className={notice ? 'toast visible' : 'toast'} role="status" aria-live="polite">{notice}</div>
    <dialog ref={modal} className={overlay === 'cart' ? 'store-dialog cart-dialog' : 'store-dialog'} onCancel={() => setOverlay(null)} onClose={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOverlay(null) } }} aria-labelledby="dialog-title">
      <button className="icon-button dialog-close" aria-label="Đóng" onClick={() => setOverlay(null)}><Icon name="close" /></button>
      {overlay === 'product' && selected && <div className="product-detail"><img src={selected.image} alt={selected.name} /><div><p className="eyebrow">{selected.category}</p><h2 id="dialog-title">{selected.name}</h2><p className="price">{money(selected.price)}</p><p>{selected.description}</p><p className="detail-note">Sản phẩm và giá minh họa. Thông số và tồn kho chưa được xác minh.</p><button className="button primary" onClick={() => add(selected)}>Thêm vào giỏ minh họa <Icon name="plus" /></button></div></div>}
      {overlay === 'cart' && <div className="cart-content"><h2 id="dialog-title">Giỏ hàng <span>({count})</span></h2><p className="detail-note">Giỏ minh họa; chưa tạo đơn hoặc giữ hàng.</p>{count ? <><ul className="cart-list">{products.filter(p => cart[p.id]).map(p => <li key={p.id}><img src={p.image} alt={p.name} /><div><h3>{p.name}</h3><p>{money(p.price)}</p><div className="quantity"><button aria-label={`Giảm số lượng ${p.name}`} onClick={() => change(p.id, -1)}><Icon name="minus" /></button><span>{cart[p.id]}</span><button aria-label={`Tăng số lượng ${p.name}`} onClick={() => change(p.id, 1)}><Icon name="plus" /></button></div></div><button className="icon-button" aria-label={`Xóa ${p.name}`} onClick={() => setCart(current => { const next = { ...current }; delete next[p.id]; return next })}><Icon name="close" /></button></li>)}</ul><div className="cart-total"><span>Tạm tính minh họa</span><strong>{money(total)}</strong></div><p className="detail-note">Đặt hàng sẽ được bổ sung trong giai đoạn tiếp theo.</p></> : <div className="empty-state"><Icon name="bag" /><h3>Giỏ hàng chưa có món gốm nào</h3></div>}<Link className="button primary" to="/products" onClick={() => setOverlay(null)}>Tiếp tục khám phá <Icon name="arrow" /></Link></div>}
      {notice && <p className="dialog-notice" role="status">{notice}</p>}
    </dialog>
  </>
}
