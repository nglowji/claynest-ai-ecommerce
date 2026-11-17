import { Link } from 'react-router-dom'
import Icon from './Icon'
import ProductGrid, { type ProductActions } from './ProductGrid'
import { StoryCards } from './Stories'
import { products } from '../data/products'

const categoryLink = (category: string) => `/products?category=${encodeURIComponent(category)}`

export default function HomePage(actions: ProductActions) {
  return <>
    <section className="banner" aria-labelledby="hero-title">
      <img src="/images/slow-living/banner-wide.jpg" alt="Gốm mộc và cành olive trên bàn gỗ bên cửa sổ ngập nắng" fetchPriority="high" width="2172" height="724" />
      <div className="banner-shade" />
      <div className="banner-content container"><p className="eyebrow">NÀNG GỐM — GỐM MỘC & CHUYỆN NHÀ</p>
        <h1 id="hero-title">Chậm một nhịp.<br />Chạm <em>bình yên.</em></h1>
        <p>Một tách trà, một nhành hoa.<br />Một chút an yên cho mỗi ngày.</p>
        <Link className="button primary" to="/products">Ghé chọn một món gốm <Icon name="arrow" /></Link>
      </div>
    </section>

    <section className="welcome-section container" aria-labelledby="welcome-title">
      <p className="eyebrow">CHÀO BẠN, NÀNG ĐÂY.</p><h2 id="welcome-title">Có những điều nhỏ,<br />làm mình <em>thương nhà hơn.</em></h2>
      <p>Một chiếc cốc vừa tay. Một bình hoa bên cửa sổ. Một bộ bát khiến mình muốn bày bữa cơm thật đẹp. Nàng Gốm dành cho những điều giản dị ấy — những món đồ không chỉ để ngắm, mà để cùng mình đi qua từng ngày.</p>
      <span className="welcome-signature">Một chút đất. Một chút nắng. Thật nhiều thương.</span>
    </section>

    <section className="products-section container" aria-labelledby="featured-title">
      <div className="section-heading"><div><p className="eyebrow">NHỮNG MÓN GỐM NÀNG MUỐN KỂ</p><h2 id="featured-title">Gốm cho <em>mỗi ngày.</em></h2></div><Link className="text-link" to="/products">Xem tất cả <Icon name="arrow" /></Link></div>
      <ProductGrid items={products.slice(0, 4)} {...actions} />
    </section>

    <section id="collections" className="collections-section container" aria-labelledby="collections-title">
      <div className="section-heading"><div><p className="eyebrow">MỖI GÓC NHÀ, MỘT CẢM HỨNG</p><h2 id="collections-title">Bạn muốn mang<br /><em>điều gì về nhà?</em></h2></div><p className="heading-description">Một chút mộc, một chút màu.<br />Chọn theo cách bạn sống và yêu.</p></div>
      <div className="collection-mosaic">
        <Link className="collection-tile collection-tile-large" to={categoryLink('Bộ sưu tập')}><img src="/images/slow-living/lifestyle.jpg" alt="Gốm trên bàn ăn sáng với bánh và sách trong ánh nắng" loading="lazy" width="1536" height="1024" /><div><p>01 / NHỮNG NGÀY THẬT CHẬM</p><h3>Chủ nhật ở nhà.</h3><span>Một bộ gốm cho những phút ngồi lại <Icon name="arrow" /></span></div></Link>
        <Link className="collection-tile" to={categoryLink('Bình hoa')}><img src="/images/nang-gom/flowers.jpg" alt="Hoa trắng trong bình đất bên góc đọc sách" loading="lazy" width="1536" height="1024" /><div><p>02 / MỘT GÓC NHÀ XANH</p><h3>Nắng ghé, hoa về.</h3><span>Khám phá bình hoa <Icon name="arrow" /></span></div></Link>
        <Link className="collection-tile" to={categoryLink('Cốc & tách')}><img src="/images/slow-living/cup.jpg" alt="Cốc cà phê men xanh trên khăn vải mộc" loading="lazy" width="1254" height="1254" /><div><p>03 / MỘT KHOẢNG RIÊNG MÌNH</p><h3>Hẹn nhau bên tách trà.</h3><span>Ghé xem cốc & tách <Icon name="arrow" /></span></div></Link>
      </div>
    </section>

    <section id="story" className="nang-story-section" aria-labelledby="story-title"><div className="container nang-story-inner">
      <div className="nang-story-image"><img src="/images/nang-gom/studio.jpg" alt="Kệ gỗ trưng bày nhiều dáng gốm trong không gian ngập nắng — ảnh AI minh họa" loading="lazy" width="1536" height="1024" /><span>MỘT NƠI CHỐN CHO NHỮNG ĐIỀU MỘC MẠC</span></div>
      <div className="nang-story-copy"><p className="eyebrow">VÌ SAO LÀ NÀNG GỐM?</p><h2 id="story-title">Nàng không chỉ<br />kể chuyện <em>về gốm.</em></h2><p>Nàng kể chuyện về một căn bếp có người chờ. Về buổi chiều mình cắm vội vài nhành hoa. Về chiếc cốc quen, cầm lên là thấy ngày bớt vội.</p><p>Chúng mình yêu những sắc màu gần với đất, những đường nét mềm và cảm giác chân thật khi một món đồ được đặt vào đúng góc nhà. Không cần cầu kỳ để đẹp. Không cần thật nhiều để đủ.</p><p>Ở Nàng Gốm, mỗi gợi ý đều bắt đầu bằng một câu hỏi nhỏ: món đồ này sẽ làm ngày của bạn dễ thương hơn như thế nào?</p><Link className="text-link" to="/stories">Nghe Nàng kể tiếp <Icon name="arrow" /></Link><span className="nang-signature">Thương, Nàng.</span></div>
    </div></section>

    <section id="craft" className="craft-section container" aria-labelledby="craft-title">
      <div className="section-heading"><div><p className="eyebrow">ĐẤT, ĐÔI BÀN TAY VÀ THỜI GIAN</p><h2 id="craft-title">Trước khi về nhà,<br />gốm có <em>một hành trình.</em></h2></div><p className="heading-description">Một góc nhìn cảm hứng về gốm thủ công.<br />Nơi mình học cách trân trọng những điều được làm chậm.</p></div>
      <div className="craft-grid">
        <article><div className="craft-image"><img src="/images/slow-living/artisan.jpg" alt="Bàn tay tạo hình bát đất trên bàn xoay" loading="lazy" width="1536" height="1024" /></div><div className="craft-title"><span>01</span><h3>Đất tìm một dáng hình.</h3></div><p>Từ một khối đất, những chuyển động của bàn tay gợi nên đường cong, dáng đứng và cảm giác của một món gốm.</p></article>
        <article><div className="craft-image"><img src="/images/nang-gom/glazing.jpg" alt="Bàn tay người thợ dùng cọ phủ men xanh lên bát gốm" loading="lazy" width="1536" height="1024" /></div><div className="craft-title"><span>02</span><h3>Men kể chuyện bằng màu.</h3></div><p>Màu ngà của nắng, xanh của lá, nâu ấm của đất. Những sắc màu Nàng yêu đều có một chút gì đó từ thiên nhiên.</p></article>
        <article><div className="craft-image"><img src="/images/slow-living/hero.jpg" alt="Bát, cốc và bình gốm bên cửa sổ cùng cành olive" loading="lazy" width="1536" height="1024" /></div><div className="craft-title"><span>03</span><h3>Và rồi, gốm có một ngôi nhà.</h3></div><p>Câu chuyện không dừng ở một món đồ đẹp. Nó tiếp tục trong tách trà bạn rót, nhành hoa bạn cắm, những ngày bạn sống.</p></article>
      </div>
    </section>

    <section className="gift-section container" aria-labelledby="gift-title"><div className="gift-copy"><p className="eyebrow">CÓ NHỮNG LỜI THƯƠNG KHÔNG CẦN NÓI LỚN</p><h2 id="gift-title">Tặng một món gốm.<br />Gửi <em>một chút mình.</em></h2><p>Cho người vừa có một căn nhà mới. Cho người hay pha trà mỗi tối. Hoặc cho chính bạn, sau một tuần đã thật cố gắng.</p><p>Đôi khi, món quà đáng nhớ nhất là món đồ khiến người nhận nghĩ: “À, người ấy nhớ mình thích điều này.”</p><Link className="button primary" to={categoryLink('Bộ sưu tập')}>Chọn một món quà <Icon name="arrow" /></Link><Link className="gift-story-link" to="/stories/mon-qua-mang-theo-loi-thuong">Một chút cảm hứng tặng quà ↗</Link></div><div className="gift-image"><img src="/images/nang-gom/gift.jpg" alt="Hộp quà cốc gốm, ruy băng vải và thiệp trắng — ý tưởng đóng gói minh họa" loading="lazy" width="1536" height="1024" /></div></section>

    <section id="journal" className="journal-section container" aria-labelledby="journal-title"><div className="section-heading"><div><p className="eyebrow">NHẬT KÝ NHÀ NÀNG</p><h2 id="journal-title">Chuyện gốm.<br /><em>Chuyện mình.</em></h2></div><Link className="text-link" to="/stories">Đọc những câu chuyện <Icon name="arrow" /></Link></div><StoryCards /></section>

    <section className="nang-invitation" aria-labelledby="invitation-title"><div className="container invitation-inner"><span className="invitation-flower" aria-hidden="true">✳</span><p className="eyebrow">MÌNH KHÔNG CẦN THÊM QUÁ NHIỀU</p><h2 id="invitation-title">Chỉ cần vài điều<br /><em>thật sự muốn giữ lại.</em></h2><p>Một món gốm hợp ý. Một góc nhà ấm.<br />Và những ngày bình thường cũng đáng để nâng niu.</p><Link className="button primary" to="/products">Tìm món gốm của bạn <Icon name="arrow" /></Link><span className="invitation-signature">Nàng Gốm</span></div></section>
  </>
}
