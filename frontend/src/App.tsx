import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import Icon from './components/Icon'
import Brand from './components/Brand'
import SiteLocation from './components/SiteLocation'
import LoginPage from './components/LoginPage'
import AccountPage from './components/AccountPage'
import { AuthProvider, useAuth } from './auth/AuthContext'
import ProductPrice from './components/ProductPrice'
import ProductGrid, { type ProductActions } from './components/ProductGrid'
import HomePage from './components/HomePage'
import { StoriesPage, StoryPage } from './components/Stories'
import { stories } from './data/stories'
import { categories, products, money, normalize, isOnSale, type Category, type Product } from './data/products'

type Cart = Record<number, number>
function ProductsPage(actions: ProductActions) {
  const [params, setParams] = useSearchParams()
  const input = useRef<HTMLInputElement>(null)
  const category = categories.includes(params.get('category') as Category) ? params.get('category') as Category : 'Tất cả'
  const query = params.get('q') || ''
  const saleOnly = params.get('sale') === '1'
  const sort = params.get('sort') || 'default'
  const visible = products.filter(product => (category === 'Tất cả' || product.category === category) && (!saleOnly || isOnSale(product)) && normalize(`${product.name} ${product.note} ${product.category}`).includes(normalize(query.trim())))
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
    <div className="catalog-heading"><p className="eyebrow">CỬA HÀNG NÀNG GỐM</p><h1 id="catalog-title">Tất cả <em>sản phẩm.</em></h1><p>Tìm một món gốm hợp với góc nhỏ của bạn.</p></div>
    <div className="catalog-controls">
      <div className="search-panel"><Icon name="search" /><input ref={input} value={query} onChange={event => update('q', event.target.value)} placeholder="Tìm món gốm bạn yêu…" aria-label="Tìm kiếm sản phẩm" />
        {query && <button className="icon-button" aria-label="Xóa tìm kiếm" onClick={() => update('q', '')}><Icon name="close" /></button>}
      </div>
      <label className="sort-control"><span>Sắp xếp</span><select value={sort} onChange={event => update('sort', event.target.value)}><option value="default">Mặc định</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label>
    </div>
    <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label="Lọc theo danh mục">{categories.map(item => <button key={item} className={category === item ? 'category-tab active' : 'category-tab'} aria-pressed={category === item} onClick={() => update('category', item)}>{item}</button>)}</div><div className="catalog-result-options"><label className="sale-filter"><input type="checkbox" checked={saleOnly} onChange={event => update('sale', event.target.checked ? '1' : '')} />Chỉ xem ưu đãi</label><span className="result-count" role="status">{visible.length} sản phẩm</span></div></div>
    <ProductGrid items={visible} {...actions} /><p className="sale-demo-note">Sản phẩm, giá và ưu đãi đang là dữ liệu minh họa.</p>
    {!visible.length && <div className="empty-state"><h2>Chưa tìm thấy món gốm phù hợp</h2><p>Thử một từ khóa hoặc danh mục khác nhé.</p><button className="button primary" onClick={() => setParams({})}>Xem tất cả sản phẩm</button></div>}
  </section>
}

export default function App() { return <AuthProvider><StoreApp /></AuthProvider> }

function StoreApp() {
  const auth = useAuth()
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
    const story = stories.find(item => location.pathname === `/stories/${item.slug}`)
    document.title = location.pathname === '/login' ? 'Đăng nhập | Nàng Gốm' : location.pathname === '/account' ? 'Tài khoản quản trị | Nàng Gốm' : story ? `${story.title} | Nàng Gốm` : location.pathname === '/products' ? 'Tất cả sản phẩm | Nàng Gốm' : location.pathname.startsWith('/stories') ? 'Chuyện của gốm | Nàng Gốm' : 'Nàng Gốm | Gốm mộc & chuyện nhà'
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
      <Brand />
      <nav id="mobile-nav" className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Điều hướng chính">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-active' : ''}>Trang chủ</NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'nav-active' : ''}>Sản phẩm</NavLink>
        <Link to="/#collections" onClick={() => setMenuOpen(false)}>Bộ sưu tập</Link>
        <Link to="/#story" onClick={() => setMenuOpen(false)}>Về Nàng</Link>
        <NavLink to="/stories" className={({ isActive }) => isActive ? 'nav-active' : ''}>Chuyện của gốm</NavLink>
      </nav>
      <div className="header-actions"><Link className="icon-button" aria-label="Tìm kiếm sản phẩm" to="/products?search=1"><Icon name="search" /></Link>
        <Link className="icon-button account-link" aria-label={auth.user ? 'Tài khoản quản trị' : 'Đăng nhập'} to={auth.user ? '/account' : '/login'}><Icon name="user" /></Link>
        <button className="icon-button bag-button" aria-label={`Giỏ hàng, ${count} sản phẩm`} onClick={() => setOverlay('cart')}><Icon name="bag" /><span className="bag-count">{count}</span></button>
        <button className="icon-button menu-button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
    </div></header>
    <main id="main"><Routes>
      <Route path="/" element={<HomePage {...actions} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/products" element={<ProductsPage {...actions} />} />
      <Route path="/stories" element={<StoriesPage />} />
      <Route path="/stories/:slug" element={<StoryPage />} />
      <Route path="*" element={<section className="container empty-state not-found"><h1>Không tìm thấy trang</h1><Link className="button primary" to="/">Về trang chủ <Icon name="arrow" /></Link></section>} />
    </Routes></main>
    <footer className="site-footer"><SiteLocation /><div className="container footer-main"><div className="footer-brand"><Brand /><p>Một chút mộc cho nhà.<br />Một chút thương cho những ngày bình thường.</p></div><div className="footer-column"><h2>Ghé nhà Nàng</h2><Link to="/products">Tất cả sản phẩm</Link><Link to="/#collections">Những bộ sưu tập</Link><Link to="/#story">Câu chuyện Nàng Gốm</Link><Link to="/#location">Địa chỉ & bản đồ</Link></div><div className="footer-column"><h2>Ở lại một chút</h2><Link to="/stories">Chuyện của gốm</Link><Link to="/#craft">Từ đất đến gốm</Link><Link to="/products?category=B%E1%BB%99%20s%C6%B0u%20t%E1%BA%ADp">Một món quà nhỏ</Link></div><div className="footer-message"><p className="eyebrow">THƯƠNG NHÀ, THƯƠNG MÌNH</p><p>Nhà không cần thật lớn.<br />Chỉ cần có những điều mình yêu.</p><span>Nàng Gốm</span></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Nàng Gốm</span><span>Crafted with care by nglowji.</span><Link to="/">Về nhà Nàng ↑</Link></div></footer>
    <div className={notice ? 'toast visible' : 'toast'} role="status" aria-live="polite">{notice}</div>
    <dialog ref={modal} className={overlay === 'cart' ? 'store-dialog cart-dialog' : 'store-dialog'} onCancel={() => setOverlay(null)} onClose={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOverlay(null) } }} aria-labelledby="dialog-title">
      <button className="icon-button dialog-close" aria-label="Đóng" onClick={() => setOverlay(null)}><Icon name="close" /></button>
      {overlay === 'product' && selected && <div className="product-detail"><img src={selected.image} alt={selected.name} /><div><p className="eyebrow">{selected.category}</p><h2 id="dialog-title">{selected.name}</h2><ProductPrice product={selected} /><p>{selected.description}</p><p className="detail-note">Sản phẩm và giá minh họa. Thông số và tồn kho chưa được xác minh.</p><button className="button primary" onClick={() => add(selected)}>Thêm vào giỏ minh họa <Icon name="plus" /></button></div></div>}
      {overlay === 'cart' && <div className="cart-content"><h2 id="dialog-title">Giỏ hàng <span>({count})</span></h2><p className="detail-note">Giỏ minh họa; chưa tạo đơn hoặc giữ hàng.</p>{count ? <><ul className="cart-list">{products.filter(p => cart[p.id]).map(p => <li key={p.id}><img src={p.image} alt={p.name} /><div><h3>{p.name}</h3><ProductPrice product={p} /><div className="quantity"><button aria-label={`Giảm số lượng ${p.name}`} onClick={() => change(p.id, -1)}><Icon name="minus" /></button><span>{cart[p.id]}</span><button aria-label={`Tăng số lượng ${p.name}`} onClick={() => change(p.id, 1)}><Icon name="plus" /></button></div></div><button className="icon-button" aria-label={`Xóa ${p.name}`} onClick={() => setCart(current => { const next = { ...current }; delete next[p.id]; return next })}><Icon name="close" /></button></li>)}</ul><div className="cart-total"><span>Tạm tính minh họa</span><strong>{money(total)}</strong></div><p className="detail-note">Đặt hàng sẽ được bổ sung trong giai đoạn tiếp theo.</p></> : <div className="empty-state"><Icon name="bag" /><h3>Giỏ hàng chưa có món gốm nào</h3></div>}<Link className="button primary" to="/products" onClick={() => setOverlay(null)}>Tiếp tục khám phá <Icon name="arrow" /></Link></div>}
      {notice && <p className="dialog-notice" role="status">{notice}</p>}
    </dialog>
  </>
}
