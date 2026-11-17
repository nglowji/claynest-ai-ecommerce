import { Link } from 'react-router-dom'
import Icon from './Icon'
import ProductGrid, { type ProductActions } from './ProductGrid'
import { StoryCards } from './Stories'
import { products } from '../data/products'

const categoryLink = (category: string) => `/products?category=${encodeURIComponent(category)}`

export default function HomePage(actions: ProductActions) {
  return <>
    <section className="banner" aria-labelledby="hero-title">
      <img className="calm-hero-image" src="/images/nang-gom/banner-calm.jpg" alt="Bát xanh, hai cốc gốm và bình hoa trên kệ đá trong ánh nắng dịu" fetchPriority="high" width="2172" height="724" />
      <div className="calm-hero-content container"><h1 id="hero-title">Bình yên, <em>ở ngay đây.</em></h1><p>Một chút gốm mộc, cho những ngày mình muốn chậm lại.</p><Link className="calm-hero-link" to="/products">Khám phá gốm của Nàng <Icon name="arrow" /></Link></div>
    </section>

    <section className="welcome-section container" aria-labelledby="welcome-title">
      <p className="eyebrow">CHÀO BẠN, NÀNG ĐÂY.</p><h2 id="welcome-title">Có những điều nhỏ,<br />làm mình <em>thương nhà hơn.</em></h2>
      <p>Một chiếc cốc vừa tay. Một bình hoa bên cửa sổ. Một bộ bát khiến mình muốn bày bữa cơm thật đẹp. Nàng Gốm dành cho những điều giản dị ấy — những món đồ không chỉ để ngắm, mà để cùng mình đi qua từng ngày.</p>
      <span className="welcome-signature">Một chút đất. Một chút nắng. Thật nhiều thương.</span>
    </section>

    <section className="products-section container" aria-labelledby="featured-title">
      <div className="section-heading sale-section-heading"><div><p className="eyebrow"><span className="sale-heading-label">HOT SALE</span> MỘT CHÚT ƯU ĐÃI, THÊM MỘT CHÚT THƯƠNG</p><h2 id="featured-title">Gốm xinh.<br /><em>Giá thêm thương.</em></h2></div><div className="sale-heading-aside"><span>Góc ưu đãi của Nàng</span><Link className="text-link" to="/products">Xem tất cả <Icon name="arrow" /></Link></div></div>
      <ProductGrid items={products.slice(0, 4)} {...actions} /><p className="sale-demo-note">Giá gốc, giá ưu đãi và nhãn Hot Sale là dữ liệu minh họa cho giao diện, chưa phải chương trình khuyến mãi thực tế.</p>
    </section>

    <section id="collections" className="collections-section container" aria-labelledby="collections-title">
      <div className="section-heading"><div><p className="eyebrow">CHỌN THEO MỘT CHÚT CẢM HỨNG</p><h2 id="collections-title">Ba góc nhỏ.<br /><em>Ba cách thương nhà.</em></h2></div><div className="collection-heading-note"><p>Không cần thay đổi cả căn nhà.<br />Bắt đầu từ một góc mình yêu.</p><Link className="text-link" to="/products">Ghé cửa hàng <Icon name="arrow" /></Link></div></div>
      <div className="collection-edits">
        {[
          { category: 'Bộ sưu tập', title: 'Chủ nhật ở nhà.', note: 'CHO NHỮNG NGÀY THẬT CHẬM', description: 'Bày một bữa sáng. Dành một khoảng riêng. Để ngày nghỉ được thong thả thêm chút nữa.', image: '/images/slow-living/lifestyle.jpg', alt: 'Bàn ăn sáng với gốm, bánh và cuốn sách', label: 'Khám phá bộ sưu tập', shape: 'landscape' },
          { category: 'Bình hoa', title: 'Nắng ghé, hoa về.', note: 'CHO MỘT GÓC NHÀ XANH', description: 'Một chiếc bình, vài nhành hoa. Những điều nhỏ đủ làm căn phòng dịu lại.', image: '/images/nang-gom/flowers.jpg', alt: 'Bình hoa trắng bên góc đọc sách có nắng', label: 'Ghé xem bình hoa', shape: 'arch' },
          { category: 'Cốc & tách', title: 'Một tách, thật chậm.', note: 'CHO MỘT KHOẢNG RIÊNG MÌNH', description: 'Chọn chiếc cốc vừa tay, pha một điều mình thích. Hôm nay, dành cho mình vài phút.', image: '/images/slow-living/cup.jpg', alt: 'Cốc men xanh có cà phê trên khăn vải mộc', label: 'Chọn cốc & tách', shape: 'postcard' },
        ].map((collection, index) => <Link className={`collection-edit collection-edit-${collection.shape}`} key={collection.category} to={categoryLink(collection.category)}>
          <div className="collection-edit-image"><img src={collection.image} alt={collection.alt} loading="lazy" width="1536" height="1024" /></div>
          <div className="collection-edit-copy"><p className="collection-edit-kicker"><span>{String(index + 1).padStart(2, '0')}</span>{collection.note}</p><h3>{collection.title}</h3><p className="collection-edit-description">{collection.description}</p><span className="collection-edit-link">{collection.label}<Icon name="arrow" /></span></div>
        </Link>)}
      </div>
    </section>

    <section id="story" className="nang-story-section" aria-labelledby="story-title"><div className="container nang-story-inner">
      <div className="nang-story-image"><img src="/images/nang-gom/studio.jpg" alt="Kệ gỗ trưng bày nhiều dáng gốm trong không gian ngập nắng — ảnh AI minh họa" loading="lazy" width="1536" height="1024" /><span>MỘT NƠI CHỐN CHO NHỮNG ĐIỀU MỘC MẠC</span></div>
      <div className="nang-story-copy"><p className="eyebrow">VÌ SAO LÀ NÀNG GỐM?</p><h2 id="story-title">Nàng không chỉ<br />kể chuyện <em>về gốm.</em></h2><p>Nàng kể chuyện về một căn bếp có người chờ. Về buổi chiều mình cắm vội vài nhành hoa. Về chiếc cốc quen, cầm lên là thấy ngày bớt vội.</p><p>Chúng mình yêu những sắc màu gần với đất, những đường nét mềm và cảm giác chân thật khi một món đồ được đặt vào đúng góc nhà. Không cần cầu kỳ để đẹp. Không cần thật nhiều để đủ.</p><p>Ở Nàng Gốm, mỗi gợi ý đều bắt đầu bằng một câu hỏi nhỏ: món đồ này sẽ làm ngày của bạn dễ thương hơn như thế nào?</p><Link className="text-link" to="/stories">Nghe Nàng kể tiếp <Icon name="arrow" /></Link><span className="nang-signature">Thương, Nàng.</span></div>
    </div></section>

    <section id="craft" className="craft-section container" aria-labelledby="craft-title">
      <div className="craft-board">
        <div className="craft-intro"><p className="eyebrow">ĐẤT, ĐÔI BÀN TAY VÀ THỜI GIAN</p><h2 id="craft-title">Một chút đất.<br />Một đôi tay.<br /><em>Một hành trình.</em></h2><p>Trước khi trở thành một phần của góc nhà, gốm đi qua những phút giây thật chậm.</p><span className="craft-handwritten">Điều đẹp đẽ cần một chút kiên nhẫn.</span><div className="craft-intro-footer"><span>GHI CHÉP VỀ GỐM</span><span aria-hidden="true">↘</span></div></div>
        <ol className="craft-trail">
          <li className="craft-step"><div className="craft-vignette craft-vignette-arch"><img src="/images/slow-living/artisan.jpg" alt="Bàn tay tạo hình bát đất trên bàn xoay" loading="lazy" width="1536" height="1024" /></div><div className="craft-step-copy"><span className="craft-step-no">01 — TẠO DÁNG</span><h3>Đất tìm một dáng hình.</h3><p>Từ chuyển động của đôi tay, đất có đường cong, dáng đứng và một nét riêng để nhớ.</p></div></li>
          <li className="craft-step"><div className="craft-vignette craft-vignette-landscape"><img src="/images/nang-gom/glazing.jpg" alt="Cọ mềm phủ men xanh lên bát gốm" loading="lazy" width="1536" height="1024" /></div><div className="craft-step-copy"><span className="craft-step-no">02 — PHỐI SẮC</span><h3>Men kể chuyện bằng màu.</h3><p>Ngà của nắng, xanh của lá, nâu ấm của đất. Một bảng màu Nàng mượn từ thiên nhiên.</p><div className="clay-swatches" aria-label="Bảng màu ngà, xanh olive và nâu đất"><span /><span /><span /></div></div></li>
          <li className="craft-step"><div className="craft-vignette craft-vignette-round"><img src="/images/slow-living/hero.jpg" alt="Bình, bát và cốc gốm trong một góc nhà có nắng" loading="lazy" width="1536" height="1024" /></div><div className="craft-step-copy"><span className="craft-step-no">03 — VỀ NHÀ</span><h3>Gốm ở lại. Chuyện bắt đầu.</h3><p>Trong tách trà bạn rót, nhành hoa bạn cắm. Một món gốm, và những ngày rất đỗi bình thường.</p></div></li>
        </ol>
      </div>
    </section>

    <section className="gift-section container" aria-labelledby="gift-title"><div className="gift-copy"><p className="eyebrow">CÓ NHỮNG LỜI THƯƠNG KHÔNG CẦN NÓI LỚN</p><h2 id="gift-title">Tặng một món gốm.<br />Gửi <em>một chút mình.</em></h2><p>Cho người vừa có một căn nhà mới. Cho người hay pha trà mỗi tối. Hoặc cho chính bạn, sau một tuần đã thật cố gắng.</p><p>Đôi khi, món quà đáng nhớ nhất là món đồ khiến người nhận nghĩ: “À, người ấy nhớ mình thích điều này.”</p><Link className="button primary" to={categoryLink('Bộ sưu tập')}>Chọn một món quà <Icon name="arrow" /></Link><Link className="gift-story-link" to="/stories/mon-qua-mang-theo-loi-thuong">Một chút cảm hứng tặng quà ↗</Link></div><div className="gift-image"><img src="/images/nang-gom/gift.jpg" alt="Hộp quà cốc gốm, ruy băng vải và thiệp trắng — ý tưởng đóng gói minh họa" loading="lazy" width="1536" height="1024" /></div></section>

    <section id="journal" className="journal-section container" aria-labelledby="journal-title"><div className="section-heading"><div><p className="eyebrow">NHẬT KÝ NHÀ NÀNG</p><h2 id="journal-title">Chuyện gốm.<br /><em>Chuyện mình.</em></h2></div><Link className="text-link" to="/stories">Đọc những câu chuyện <Icon name="arrow" /></Link></div><StoryCards variant="editorial" /></section>

    <section className="nang-invitation" aria-labelledby="invitation-title"><div className="container invitation-note"><div className="invitation-still"><img src="/images/slow-living/vase.jpg" alt="Bình gốm đất nung với vài nhành hoa khô" loading="lazy" width="1254" height="1254" /><span>một chút mộc.</span></div><div className="invitation-note-title"><h2 id="invitation-title">Một món gốm nhỏ.<br /><em>Một niềm vui ở lại.</em></h2></div><div className="invitation-note-action"><p>Chọn điều mình thật sự yêu.<br />Để mỗi lần trở về,<br />nhà lại có thêm một chút thương.</p><Link to="/products">Tìm món gốm của bạn <span><Icon name="arrow" /></span></Link></div></div></section>

  </>
}
