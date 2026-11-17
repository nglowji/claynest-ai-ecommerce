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
  const [saved, setSaved] = useState<number[]>([])
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

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target) }
      })
    }, { threshold: 0.08 })
    document.querySelectorAll('[data-reveal]').forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('will-reveal')
      observer.observe(element)
    })
    return () => observer.disconnect()
  }, [])

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
    <div className="announcement"><span aria-hidden="true">✳</span> Một chút gốm mộc. Một chút bình yên. <span aria-hidden="true">✳</span></div>
    <header className="site-header">
      <div className="header-inner container">
        <a className="brand" href="#" aria-label="ClayNest — Trang chủ"><span className="brand-mark"><Icon name="leaf" /></span>claynest<span className="brand-dot">.</span></a>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Điều hướng chính">
          <a className="nav-active" href="#products" onClick={() => choose('Tất cả')}>Cửa hàng</a>
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
          <p className="eyebrow hero-eyebrow"><span className="live-dot" /> GỐM MỘC CHO NHỮNG NGÀY THẢNH THƠI</p>
          <h1 id="hero-title">Chậm một nhịp.<br />Chạm <em>bình yên.</em></h1>
          <p className="hero-description">Giữa những ngày vội vã, dành cho mình một góc nhỏ.<br className="desktop-break" /> Một tách trà ấm, một nhành hoa, một món gốm thương.</p>
          <div className="hero-links"><a className="button primary" href="#products" onClick={() => choose('Tất cả')}>Tìm món gốm của bạn <Icon name="arrow" /></a><a className="hero-story-link" href="#story">Chuyện của gốm <span>↗</span></a></div>
          <div className="hero-footnote"><span className="footnote-line" /><span>Đẹp theo cách tự nhiên.<br />Riêng theo cách của bạn.</span><Icon name="leaf" /></div>
        </div>
        <div className="hero-visual">
          <img className="hero-image" src="/images/slow-living/hero.jpg" alt="Bình gốm cắm cành olive, bát xanh và cốc đất trong nắng sớm bên cửa sổ" fetchPriority="high" width="1536" height="1024" />
          <span className="hero-photo-tag"><span /> THE ART OF SLOW LIVING</span>
          <div className="hero-stamp" aria-hidden="true"><span>ĐẤT • NẮNG • AN YÊN</span><Icon name="leaf" /><span>CLAYNEST STUDIO</span></div>
          <a href="#collection" className="hero-floating-card"><span className="floating-icon"><Icon name="leaf" /></span><span><small>MỘT GÓC NHÀ, MỘT CHÚT THƠ</small><strong>Nhẹ nhàng mà ở lại.</strong></span><span className="round-arrow"><Icon name="arrow" /></span></a>
        </div>
      </section>
      <div className="values-strip container">
        <div><Icon name="hand" /><span>Yêu nét riêng của gốm</span></div><span className="value-separator" aria-hidden="true">✧</span>
        <div><Icon name="leaf" /><span>Gần thiên nhiên hơn một chút</span></div><span className="value-separator" aria-hidden="true">✧</span>
        <div><Icon name="gift" /><span>Món quà từ sự quan tâm</span></div>
      </div>
      <section className="moments-section container" aria-labelledby="moments-title" data-reveal>
        <div className="moments-intro"><p className="eyebrow">GỐM Ở ĐÂU, THƯƠNG Ở ĐÓ</p><h2 id="moments-title">Cho góc nhỏ<br /><em>bạn yêu.</em></h2></div>
        {([
          { category: 'Cốc & tách' as Category, icon: 'cup' as const, title: 'Một buổi sáng chậm', text: 'Cốc & tách cho phút riêng mình', no: '01' },
          { category: 'Bình hoa' as Category, icon: 'vase' as const, title: 'Một góc nhà xanh', text: 'Bình gốm & những nhành hoa', no: '02' },
          { category: 'Bộ sưu tập' as Category, icon: 'tea' as const, title: 'Một lời thương gửi', text: 'Bộ gốm dành cho người bạn quý', no: '03' },
        ]).map(moment => <a key={moment.no} href="#products" className="moment-card" onClick={() => choose(moment.category)}><div className="moment-top"><span>{moment.no}</span><Icon name="arrow" /></div><Icon name={moment.icon} /><h3>{moment.title}</h3><p>{moment.text}</p></a>)}
      </section>
      <section id="products" className="products-section container" aria-labelledby="products-title" data-reveal>
        <div className="section-heading"><div><p className="eyebrow">NHỮNG ĐIỀU NHỎ, ĐƯỢC YÊU THƯƠNG</p><h2 id="products-title">Gặp món gốm <em>của bạn.</em></h2></div><a className="text-link" href="#products" onClick={() => choose('Tất cả')}>Xem tất cả <Icon name="arrow" /></a></div>
        <div className="catalog-toolbar"><div className="category-tabs" role="group" aria-label="Lọc theo danh mục">{categories.map(item => <button key={item} className={category === item ? 'category-tab active' : 'category-tab'} aria-pressed={category === item} onClick={() => choose(item)}>{item}</button>)}</div><span className="demo-label">{visible.length.toString().padStart(2, '0')} món gốm · Bộ sưu tập minh họa</span></div>
        <div id="search-panel" hidden={!searchOpen} className="search-panel"><Icon name="search" /><input ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm cốc, bình hoa, sắc men…" aria-label="Tên hoặc danh mục sản phẩm" /><button className="icon-button" onClick={() => { setQuery(''); setSearchOpen(false) }} aria-label="Đóng tìm kiếm"><Icon name="close" /></button></div>
        <p className="sr-only" role="status">{visible.length} sản phẩm phù hợp</p>
        <div className="product-grid">{visible.map(product => <article className="product-card" key={product.id}><div className="product-media"><span className="product-badge">{product.badge}</span><button className={saved.includes(product.id) ? 'save-button is-saved' : 'save-button'} aria-label={`${saved.includes(product.id) ? 'Bỏ lưu' : 'Lưu'} ${product.name}`} aria-pressed={saved.includes(product.id)} onClick={() => setSaved(current => current.includes(product.id) ? current.filter(id => id !== product.id) : [...current, product.id])}><Icon name="heart" /></button>
          <button className={`product-image-button ${product.imageClass || ''}`} onClick={() => showProduct(product)} aria-label={`Xem ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" width="600" height="720" /><span className="quick-view">Xem gần hơn <Icon name="arrow" /></span></button></div>
          <div className="product-info"><div><p className="product-note">{product.note}</p><h3><button onClick={() => showProduct(product)}>{product.name}</button></h3><p className="price">{money(product.price)}</p></div><button className="add-button" onClick={() => add(product)} aria-label={`Thêm ${product.name} vào giỏ minh họa`}><Icon name="plus" /></button></div>
        </article>)}</div>
        {!visible.length && <div className="empty-state"><h3>Chưa tìm thấy món gốm phù hợp</h3><p>Thử một từ khóa khác hoặc khám phá toàn bộ bộ sưu tập.</p><button className="button primary" onClick={() => choose('Tất cả')}>Xem tất cả sản phẩm</button></div>}
        <p className="catalog-disclaimer">Góc trưng bày minh họa · Hình ảnh tạo bằng AI, tên và giá chưa phải thông tin bán hàng thực tế.</p>
      </section>
      <section id="collection" className="collection-section container" aria-labelledby="collection-title" data-reveal>
        <div className="collection-photo"><img src="/images/slow-living/lifestyle.jpg" alt="Cốc gốm, đĩa bánh và cuốn sách trên bàn ăn ngập nắng cạnh cửa sổ" loading="lazy" width="1536" height="1024" /><span className="photo-label">A LITTLE SLOWER. A LITTLE CLOSER.</span></div>
        <div className="collection-copy"><p className="eyebrow">THE SLOW SUNDAY EDIT</p><span className="collection-flower" aria-hidden="true">✳</span><h2 id="collection-title">Chủ nhật.<br />Nắng nghiêng.<br /><em>Trà còn ấm.</em></h2><p>Không cần đi đâu xa. Đôi khi, bình yên là một buổi sáng thật chậm trong chính ngôi nhà mình.</p><a className="button light" href="#products" onClick={() => choose('Bộ sưu tập')}>Mang chút chill về nhà <Icon name="arrow" /></a><span className="collection-edition">CLAYNEST COLLECTION / 01</span></div>
      </section>
      <section id="story" className="story-section container" aria-labelledby="story-title" data-reveal>
        <div className="story-image"><img src="/images/slow-living/artisan.jpg" alt="Bàn tay người thợ nhẹ nhàng tạo hình một chiếc bát đất trên bàn xoay trong xưởng ngập nắng" loading="lazy" width="1536" height="1024" /><div className="story-image-note"><span aria-hidden="true">✳</span><p>Vẻ đẹp nằm trong<br /><em>những điều rất riêng.</em></p></div><span className="image-credit">HÌNH ẢNH MINH HỌA BẰNG AI</span></div>
        <div className="story-copy"><p className="eyebrow">TỪ ĐẤT, QUA ĐÔI BÀN TAY</p><h2 id="story-title">Không hoàn hảo.<br />Nhưng <em>đầy cảm xúc.</em></h2><p>Một vệt men ngẫu hứng. Một đường cong chẳng giống ai. Chính những điều nhỏ ấy khiến ta muốn nâng niu một món gốm lâu hơn.</p><p>ClayNest là một lời mời sống chậm: bớt đi một chút ồn ào, thêm vào một chút tự nhiên, và tìm thấy niềm vui trong những điều gần gũi.</p><details><summary>Câu chuyện của ClayNest <Icon name="arrow" /></summary><p>Đây là ý tưởng thương hiệu cho dự án ClayNest. Ảnh xưởng là hình minh họa tạo bằng AI. Thông tin nghệ nhân, nguồn gốc và quy trình từng sản phẩm sẽ được bổ sung khi có nguồn được xác minh.</p></details><div className="story-signature">with a little love, <span>claynest.</span></div></div>
      </section>
      <section className="closing-section container" data-reveal><Icon name="leaf" /><p>Nhà là nơi mình<br /><em>được chậm lại.</em></p><a className="button primary" href="#products" onClick={() => choose('Tất cả')}>Chọn một chút bình yên <Icon name="arrow" /></a><span className="closing-doodle" aria-hidden="true">✳</span></section>
    </main>
    <footer id="contact" className="site-footer"><div className="container footer-main"><div className="footer-brand"><a className="brand" href="#">claynest<span className="brand-dot">.</span></a><p>Mang nét mộc vào nhà.<br />Mang an yên vào từng ngày.</p></div><div><h2>Khám phá</h2><a href="#products" onClick={() => choose('Tất cả')}>Tất cả sản phẩm</a><a href="#collection">Bộ sưu tập Ngày Chậm</a><a href="#story">Chuyện của ClayNest</a></div><div className="footer-note"><h2>Ghé lại cùng ClayNest</h2><p>Ở đây có gốm, có nắng, có những điều nhỏ để thương.</p><span>Bản xem trước giao diện · Chưa nhận đơn hàng</span></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} ClayNest AI</span><span>Designed for slow living · Hình ảnh minh họa tạo bằng AI</span><a href="#">Về đầu trang ↑</a></div></footer>
    <div className={notice ? 'toast visible' : 'toast'} role="status" aria-live="polite">{notice}</div>
    <dialog ref={modal} className={overlay === 'cart' ? 'store-dialog cart-dialog' : 'store-dialog'} onCancel={() => setOverlay(null)} onClose={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOverlay(null) } }} aria-labelledby="dialog-title">
      <button className="icon-button dialog-close" aria-label="Đóng" onClick={() => setOverlay(null)}><Icon name="close" /></button>
      {overlay === 'product' && selected && <div className="product-detail"><img src={selected.image} alt={selected.name} className={selected.imageClass || ''} /><div><p className="eyebrow">{selected.category}</p><h2 id="dialog-title">{selected.name}</h2><p className="price">{money(selected.price)}</p><p>{selected.description}</p><p className="detail-note">Sản phẩm và giá minh họa. Kích thước, tồn kho và thông tin sử dụng chưa được xác minh.</p><button className="button primary" onClick={() => add(selected)}>Thêm vào giỏ minh họa <Icon name="plus" /></button></div></div>}
      {overlay === 'cart' && <div className="cart-content"><p className="eyebrow">GÓC GỐM BẠN CHỌN</p><h2 id="dialog-title">Giỏ hàng <span>({count})</span></h2><p className="detail-note">Giỏ hàng minh họa trong phiên xem; chưa tạo đơn hoặc giữ hàng.</p>{count ? <><ul className="cart-list">{products.filter(p => cart[p.id]).map(p => <li key={p.id}><img src={p.image} alt={p.name} /><div><h3>{p.name}</h3><p>{money(p.price)}</p><div className="quantity"><button aria-label={`Giảm số lượng ${p.name}`} onClick={() => change(p.id, -1)}><Icon name="minus" /></button><span>{cart[p.id]}</span><button aria-label={`Tăng số lượng ${p.name}`} onClick={() => change(p.id, 1)}><Icon name="plus" /></button></div></div><button className="icon-button" aria-label={`Xóa ${p.name}`} onClick={() => setCart(current => { const next = { ...current }; delete next[p.id]; return next })}><Icon name="close" /></button></li>)}</ul><div className="cart-total"><span>Tạm tính minh họa</span><strong>{money(total)}</strong></div><p className="detail-note">Tính năng đặt hàng sẽ được bổ sung trong giai đoạn tiếp theo.</p></> : <div className="empty-state"><Icon name="bag" /><h3>Giỏ hàng đang chờ một món gốm</h3><p>Ghé bộ sưu tập và chọn điều bạn thương nhé.</p></div>}<button className="button primary" onClick={() => { setOverlay(null); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }) }}>Tiếp tục khám phá <Icon name="arrow" /></button></div>}
      {notice && <p className="dialog-notice" role="status">{notice}</p>}
    </dialog>
  </>
}
