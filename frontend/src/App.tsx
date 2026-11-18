import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Icon from './components/Icon'
import Brand from './components/Brand'
import SiteLocation from './components/SiteLocation'
import LoginPage from './components/LoginPage'
import AdminLayout from './components/AdminLayout'
import AdminPage from './components/AdminPage'
import AccountPage from './components/AccountPage'
import { AuthProvider, useAuth } from './auth/AuthContext'
import ProductPrice from './components/ProductPrice'
import ProductsPage from './components/ProductsPage'
import ProductPage from './components/ProductPage'
import AdminCatalogPage from './components/AdminCatalogPage'
import HomePage from './components/HomePage'
import { StoriesPage, StoryPage } from './components/Stories'
import { stories } from './data/stories'
import { money, type Product } from './data/products'

type Cart = Record<string, number>
export default function App() { return <AuthProvider><Routes>
  <Route path="/admin" element={<AdminLayout />}><Route index element={<AdminPage />} /><Route path="products" element={<AdminCatalogPage />} /><Route path="*" element={<section className="container account-page"><h1>Không tìm thấy trang quản trị</h1><Link to="/admin">Về tổng quan</Link></section>} /></Route>
  <Route path="*" element={<StoreApp />} />
</Routes></AuthProvider> }

function StoreApp() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cart, setCart] = useState<Cart>({})
  const [cartProducts, setCartProducts] = useState<Record<string, Product>>({})
  const [overlay, setOverlay] = useState<'cart' | null>(null)
  const [notice, setNotice] = useState('')
  const modal = useRef<HTMLDialogElement>(null)
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  const products = Object.values(cartProducts)
  const total = products.reduce((sum, p) => sum + p.price * (cart[p.variantId] || 0), 0)
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
    document.title = location.pathname === '/admin' ? 'Quản trị | Nàng Gốm' : location.pathname === '/register' ? 'Đăng ký | Nàng Gốm' : location.pathname === '/login' ? 'Đăng nhập | Nàng Gốm' : location.pathname === '/account' ? 'Tài khoản | Nàng Gốm' : story ? `${story.title} | Nàng Gốm` : location.pathname === '/products' ? 'Tất cả sản phẩm | Nàng Gốm' : location.pathname.startsWith('/stories') ? 'Chuyện của gốm | Nàng Gốm' : 'Nàng Gốm | Gốm mộc & chuyện nhà'
  }, [location.pathname])
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 3000); return () => window.clearTimeout(id) }, [notice])
  function add(product: Product) {
    if (product.stockQty <= 0) return
    setCartProducts(current => ({ ...current, [product.variantId]: product }))
    setCart(current => ({ ...current, [product.variantId]: Math.min(product.stockQty, (current[product.variantId] || 0) + 1) }))
    setNotice(`Đã thêm ${product.name} vào giỏ minh họa`)
  }
  function change(id: string, delta: number) {
    setCart(current => { const next = { ...current }; next[id] = Math.min(cartProducts[id]?.stockQty || 0, Math.max(0, (next[id] || 0) + delta)); if (!next[id]) delete next[id]; return next })
  }
  function showProduct(product: Product) { navigate('/products/' + product.slug) }
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
        <Link className="icon-button account-link" aria-label={auth.user ? 'Tài khoản' : 'Đăng nhập'} to={auth.user ? (auth.user.role === 'Admin' ? '/admin' : '/account') : '/login'}><Icon name="user" /></Link>
        <button className="icon-button bag-button" aria-label={`Giỏ hàng, ${count} sản phẩm`} onClick={() => setOverlay('cart')}><Icon name="bag" /><span className="bag-count">{count}</span></button>
        <button className="icon-button menu-button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
    </div></header>
    <main id="main"><Routes>
      <Route path="/" element={<HomePage {...actions} />} />
      <Route path="/register" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/products" element={<ProductsPage {...actions} />} />
      <Route path="/products/:slug" element={<ProductPage {...actions} />} />
      <Route path="/stories" element={<StoriesPage />} />
      <Route path="/stories/:slug" element={<StoryPage />} />
      <Route path="*" element={<section className="container empty-state not-found"><h1>Không tìm thấy trang</h1><Link className="button primary" to="/">Về trang chủ <Icon name="arrow" /></Link></section>} />
    </Routes></main>
    <footer className="site-footer"><SiteLocation /><div className="container footer-main"><div className="footer-brand"><Brand /><p>Một chút mộc cho nhà.<br />Một chút thương cho những ngày bình thường.</p></div><div className="footer-column"><h2>Ghé nhà Nàng</h2><Link to="/products">Tất cả sản phẩm</Link><Link to="/#collections">Những bộ sưu tập</Link><Link to="/#story">Câu chuyện Nàng Gốm</Link><Link to="/#location">Địa chỉ & bản đồ</Link></div><div className="footer-column"><h2>Ở lại một chút</h2><Link to="/stories">Chuyện của gốm</Link><Link to="/#craft">Từ đất đến gốm</Link><Link to="/products?category=B%E1%BB%99%20s%C6%B0u%20t%E1%BA%ADp">Một món quà nhỏ</Link></div><div className="footer-message"><p className="eyebrow">THƯƠNG NHÀ, THƯƠNG MÌNH</p><p>Nhà không cần thật lớn.<br />Chỉ cần có những điều mình yêu.</p><span>Nàng Gốm</span></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Nàng Gốm</span><span>Crafted with care by nglowji.</span><Link to="/">Về nhà Nàng ↑</Link></div></footer>
    <div className={notice ? 'toast visible' : 'toast'} role="status" aria-live="polite">{notice}</div>
    <dialog ref={modal} className="store-dialog cart-dialog" onCancel={() => setOverlay(null)} onClose={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOverlay(null) } }} aria-labelledby="dialog-title">
      <button className="icon-button dialog-close" aria-label="Đóng" onClick={() => setOverlay(null)}><Icon name="close" /></button>
      {overlay === 'cart' && <div className="cart-content"><h2 id="dialog-title">Giỏ hàng <span>({count})</span></h2><p className="detail-note">Giỏ minh họa; chưa tạo đơn hoặc giữ hàng.</p>{count ? <><ul className="cart-list">{products.filter(p => cart[p.variantId]).map(p => <li key={p.variantId}><img src={p.image} alt={p.name} /><div><h3>{p.name}</h3><ProductPrice product={p} /><div className="quantity"><button aria-label={`Giảm số lượng ${p.name}`} onClick={() => change(p.variantId, -1)}><Icon name="minus" /></button><span>{cart[p.variantId]}</span><button aria-label={`Tăng số lượng ${p.name}`} onClick={() => change(p.variantId, 1)}><Icon name="plus" /></button></div></div><button className="icon-button" aria-label={`Xóa ${p.name}`} onClick={() => setCart(current => { const next = { ...current }; delete next[p.variantId]; return next })}><Icon name="close" /></button></li>)}</ul><div className="cart-total"><span>Tạm tính minh họa</span><strong>{money(total)}</strong></div><p className="detail-note">Đặt hàng sẽ được bổ sung trong giai đoạn tiếp theo.</p></> : <div className="empty-state"><Icon name="bag" /><h3>Giỏ hàng chưa có món gốm nào</h3></div>}<Link className="button primary" to="/products" onClick={() => setOverlay(null)}>Tiếp tục khám phá <Icon name="arrow" /></Link></div>}
      {notice && <p className="dialog-notice" role="status">{notice}</p>}
    </dialog>
  </>
}
