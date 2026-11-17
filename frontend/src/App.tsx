import { useEffect, useRef, useState } from 'react'
import Icon from './components/Icon'
import { categories, products, money, normalize, type Category, type Product } from './data/products'

type Cart = Record<number, number>
export default function App() {
  const [category, setCategory] = useState<Category>('Tất cả')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cart, setCart] = useState<Cart>({})
  const [selected, setSelected] = useState<Product | null>(null)
  const [overlay, setOverlay] = useState<'product' | 'cart' | null>(null)
  const [notice, setNotice] = useState('')
  const modal = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  const total = products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0)
  const visible = products.filter(p => (category === 'Tất cả' || p.category === category) && normalize(`${p.name} ${p.note} ${p.category}`).includes(normalize(query.trim())))

  useEffect(() => {
    if (overlay) { modal.current?.showModal(); document.body.style.overflow = 'hidden' }
    else { modal.current?.close(); document.body.style.overflow = '' }
    return () => { document.body.style.overflow = '' }
  }, [overlay])
  useEffect(() => { if (searchOpen) search.current?.focus() }, [searchOpen])
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 3000); return () => window.clearTimeout(id) }, [notice])

  function add(product: Product) {
    setCart(current => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))
    setNotice(`Đã thêm ${product.name} vào giỏ minh họa`)
  }
  function change(id: number, delta: number) {
    setCart(current => { const next = { ...current }; next[id] = Math.max(0, (next[id] || 0) + delta); if (!next[id]) delete next[id]; return next })
  }
  function choose(value: Category) { setCategory(value); setQuery(''); setMenuOpen(false) }
  function showProduct(product: Product) { setSelected(product); setOverlay('product') }

  return <>
    <a className="skip-link" href="#main">Đến nội dung chính</a>
    <div className="announcement">Những món gốm nhỏ, dành cho những ngày thật chậm.<span>Được tạo nên từ cảm hứng thủ công</span></div>
    <header className="site-header">
      <div className="header-inner container">
        <a className="brand" href="#" aria-label="ClayNest — Trang chủ">claynest<span className="brand-dot">.</span><span className="brand-sub">GỐM & NHỮNG ĐIỀU AN YÊN</span></a>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Điều hướng chính">
          <a href="#products" onClick={() => choose('Tất cả')}>Cửa hàng</a>
          <a href="#collection" onClick={() => setMenuOpen(false)}>Bộ sưu tập</a>
          <a href="#story" onClick={() => setMenuOpen(false)}>Chuyện của gốm</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Kết nối</a>
        </nav>
        <div className="header-actions">
          <button className="icon-button" aria-label="Tìm kiếm sản phẩm" aria-expanded={searchOpen} aria-controls="search-panel" onClick={() => { setSearchOpen(!searchOpen); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }}><Icon name="search" /></button>
          <button className="icon-button bag-button" aria-label={`Giỏ hàng, ${count} sản phẩm`} onClick={() => setOverlay('cart')}><Icon name="bag" /><span className="bag-count">{count}</span></button>
          <button className="icon-button menu-button" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
        </div>
      </div>
    </header>
    <main id="main">
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span /> TỪ ĐẤT MỘC, ĐẾN TỔ ẤM</p>
          <h1 id="hero-title">Chạm vào gốm.<br />Chạm một chút<br /><em>bình yên.</em></h1>
          <p className="hero-description">Một chiếc cốc cho buổi sáng chậm rãi.<br />Một chiếc bình cho góc nhà thêm thương.<br />Tìm một món gốm, giữ một chút an yên.</p>
          <a className="button primary" href="#products" onClick={() => choose('Tất cả')}>Khám phá gốm <Icon name="arrow" /></a>
          <a className="hero-story-link" href="#story">Chuyện của ClayNest <span>↗</span></a>
          <div className="hero-footnote"><span className="little-star">✳</span><span>Không cần hoàn hảo.<br />Chỉ cần mang nét riêng.</span></div>
        </div>
        <div className="hero-visual">
          <img className="hero-image" src="/images/collection.jpg" alt="Bình gốm và hai chiếc cốc men trắng chấm trong ánh sáng tự nhiên" fetchPriority="high" width="1600" height="1200" />
          <div className="hero-stamp"><span>THẬT MỘC</span><span className="stamp-flower">✳</span><span>THẬT RIÊNG</span></div>
          <div className="image-caption"><span>01 / NGÀY CHẬM</span><a href="#collection" aria-label="Khám phá bộ sưu tập Ngày Chậm"><Icon name="arrow" /></a></div>
        </div>
      </section>
      <div className="values-strip container">
        <div><Icon name="hand" /><span>Lấy cảm hứng từ đôi bàn tay</span></div>
        <div><Icon name="leaf" /><span>Vẻ đẹp từ những điều giản dị</span></div>
        <div><Icon name="gift" /><span>Một món gốm, một lời quan tâm</span></div>
      </div>
      <section id="products" className="products-section container" aria-labelledby="products-title">
        <div className="section-heading"><div><p className="eyebrow">CHỌN MỘT ĐIỀU BẠN THƯƠNG</p><h2 id="products-title">Gốm cho mỗi ngày</h2></div><a className="text-link" href="#products" onClick={() => choose('Tất cả')}>Xem tất cả <Icon name="arrow" /></a></div>
        <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label="Lọc theo danh mục">{categories.map(item => <button key={item} className={category === item ? 'category-tab active' : 'category-tab'} aria-pressed={category === item} onClick={() => choose(item)}>{item}</button>)}</div><span className="demo-label">Bộ sản phẩm minh họa</span></div>
        <div id="search-panel" hidden={!searchOpen} className="search-panel"><Icon name="search" /><input ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm cốc, bình hoa, sắc men…" aria-label="Tên hoặc danh mục sản phẩm" /><button className="icon-button" onClick={() => { setQuery(''); setSearchOpen(false) }} aria-label="Đóng tìm kiếm"><Icon name="close" /></button></div>
        <p className="sr-only" role="status">{visible.length} sản phẩm phù hợp</p>
        <div className="product-grid">{visible.map(product => <article className="product-card" key={product.id}>
          <button className={`product-image-button ${product.imageClass || ''}`} onClick={() => showProduct(product)} aria-label={`Xem ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" width="600" height="720" /><span className="quick-view">Khám phá món gốm <Icon name="arrow" /></span></button>
          <div className="product-info"><div><p className="product-note">{product.note}</p><h3><button onClick={() => showProduct(product)}>{product.name}</button></h3><p className="price">{money(product.price)}</p></div><button className="add-button" onClick={() => add(product)} aria-label={`Thêm ${product.name} vào giỏ minh họa`}><Icon name="plus" /></button></div>
        </article>)}</div>
        {!visible.length && <div className="empty-state"><h3>Chưa tìm thấy món gốm phù hợp</h3><p>Thử một từ khóa khác hoặc khám phá toàn bộ bộ sưu tập.</p><button className="button primary" onClick={() => choose('Tất cả')}>Xem tất cả sản phẩm</button></div>}
        <p className="catalog-disclaimer">Tên và giá là dữ liệu minh họa. Hình ảnh mang tính gợi ý phong cách.</p>
      </section>
      <section id="collection" className="collection-section" aria-labelledby="collection-title"><div className="container collection-inner">
        <div className="collection-photo"><img src="/images/bowls.jpg" alt="Những chiếc bát men trắng ngà xếp cạnh nhau" loading="lazy" width="1200" height="800" /><span className="photo-label">THE EVERYDAY COLLECTION</span></div>
        <div className="collection-copy"><p className="eyebrow">BỘ SƯU TẬP NGÀY CHẬM</p><h2 id="collection-title">Bớt vội một chút.<br /><em>Thương nhà nhiều hơn.</em></h2><p>Những sắc men nhẹ, những đường nét mềm. Một bộ sưu tập gợi nhắc bạn dành thời gian cho những điều nhỏ bé, ngay trong chính ngôi nhà mình.</p><a className="button light" href="#products" onClick={() => choose('Bộ sưu tập')}>Ghé xem bộ sưu tập <Icon name="arrow" /></a><span className="collection-number" aria-hidden="true">01</span></div>
      </div></section>
      <section id="story" className="story-section container" aria-labelledby="story-title"><div className="story-copy"><p className="eyebrow">CHUYỆN CỦA GỐM</p><h2 id="story-title">Từ một nắm đất,<br />đến một điều <em>đáng quý.</em></h2><p>Có một vẻ đẹp nằm trong vệt xoay còn lưu lại, trong lớp men không đều và những đường cong rất riêng.</p><p>ClayNest được xây dựng từ tình yêu dành cho vẻ đẹp ấy. Chúng mình mong mỗi món gốm sẽ trở thành một phần gần gũi trong nhịp sống của bạn.</p><details><summary>Đọc thêm câu chuyện <span>+</span></summary><p>Đây là ý tưởng thương hiệu cho dự án ClayNest. Câu chuyện nghệ nhân, nguồn gốc và quy trình của từng sản phẩm sẽ được bổ sung khi có thông tin được xác minh.</p></details></div><div className="story-image"><img src="/images/studio.jpg" alt="Cận cảnh bàn tay người thợ đang tạo hình đất trên bàn xoay" loading="lazy" width="1200" height="800" /><span>Đất. Bàn tay. Và một chút kiên nhẫn.</span></div></section>
      <section className="closing-section container"><span aria-hidden="true">✳</span><p>Một món gốm nhỏ.<br /><em>Một niềm vui ở lại.</em></p><a className="text-link" href="#products" onClick={() => choose('Tất cả')}>Tìm món gốm của bạn <Icon name="arrow" /></a></section>
    </main>
    <footer id="contact" className="site-footer"><div className="container footer-main"><div className="footer-brand"><a className="brand" href="#">claynest<span className="brand-dot">.</span></a><p>Mang nét mộc vào nhà.<br />Mang an yên vào từng ngày.</p></div><div><h2>Khám phá</h2><a href="#products" onClick={() => choose('Tất cả')}>Tất cả sản phẩm</a><a href="#collection">Bộ sưu tập Ngày Chậm</a><a href="#story">Chuyện của ClayNest</a></div><div className="footer-note"><h2>Ghé lại cùng ClayNest</h2><p>Một không gian dành cho người yêu gốm và những điều giản dị.</p><span>Bản xem trước giao diện · Chưa nhận đơn hàng</span></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} ClayNest AI</span><span>Ảnh minh họa: <a href="https://unsplash.com/@tomcrewceramics" target="_blank" rel="noreferrer">Tom Crew</a> & <a href="https://unsplash.com/photos/JW7J__Nfors" target="_blank" rel="noreferrer">Ritesh Singh</a> / Unsplash</span><a href="#">Về đầu trang ↑</a></div></footer>
    <div className={notice ? 'toast visible' : 'toast'} role="status" aria-live="polite">{notice}</div>
    <dialog ref={modal} className={overlay === 'cart' ? 'store-dialog cart-dialog' : 'store-dialog'} onCancel={() => setOverlay(null)} onClose={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOverlay(null) } }} aria-labelledby="dialog-title">
      <button className="icon-button dialog-close" aria-label="Đóng" onClick={() => setOverlay(null)}><Icon name="close" /></button>
      {overlay === 'product' && selected && <div className="product-detail"><img src={selected.image} alt={selected.name} className={selected.imageClass || ''} /><div><p className="eyebrow">{selected.category}</p><h2 id="dialog-title">{selected.name}</h2><p className="price">{money(selected.price)}</p><p>{selected.description}</p><p className="detail-note">Sản phẩm và giá minh họa. Kích thước, tồn kho và thông tin sử dụng chưa được xác minh.</p><button className="button primary" onClick={() => add(selected)}>Thêm vào giỏ minh họa <Icon name="plus" /></button></div></div>}
      {overlay === 'cart' && <div className="cart-content"><p className="eyebrow">GÓC GỐM BẠN CHỌN</p><h2 id="dialog-title">Giỏ hàng <span>({count})</span></h2><p className="detail-note">Giỏ hàng minh họa trong phiên xem; chưa tạo đơn hoặc giữ hàng.</p>{count ? <><ul className="cart-list">{products.filter(p => cart[p.id]).map(p => <li key={p.id}><img src={p.image} alt={p.name} /><div><h3>{p.name}</h3><p>{money(p.price)}</p><div className="quantity"><button aria-label={`Giảm số lượng ${p.name}`} onClick={() => change(p.id, -1)}><Icon name="minus" /></button><span>{cart[p.id]}</span><button aria-label={`Tăng số lượng ${p.name}`} onClick={() => change(p.id, 1)}><Icon name="plus" /></button></div></div><button className="icon-button" aria-label={`Xóa ${p.name}`} onClick={() => setCart(current => { const next = { ...current }; delete next[p.id]; return next })}><Icon name="close" /></button></li>)}</ul><div className="cart-total"><span>Tạm tính minh họa</span><strong>{money(total)}</strong></div><p className="detail-note">Tính năng đặt hàng sẽ được bổ sung trong giai đoạn tiếp theo.</p></> : <div className="empty-state"><Icon name="bag" /><h3>Giỏ hàng đang chờ một món gốm</h3><p>Ghé bộ sưu tập và chọn điều bạn thương nhé.</p></div>}<button className="button primary" onClick={() => { setOverlay(null); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }}>Tiếp tục khám phá <Icon name="arrow" /></button></div>}
    </dialog>
  </>
}
