import { Link, useParams } from 'react-router-dom'
import Icon from './Icon'
import { stories } from '../data/stories'

export function StoryCards({ variant = 'grid' }: { variant?: 'grid' | 'editorial' }) {
  if (variant === 'editorial') {
    const [featured, ...others] = stories
    if (!featured) return null
    return <div className="journal-editorial">
      <article className="journal-feature">
        <Link to={`/stories/${featured.slug}`} className="journal-editorial-image journal-feature-image"><img src={featured.image} alt={featured.alt} loading="lazy" width="1536" height="1024" /><span className="journal-photo-caption">MỘT KHOẢNG NGHỈ TRONG NGÀY</span></Link>
        <div className="journal-feature-copy"><p className="eyebrow">{featured.category}</p><h3><Link to={`/stories/${featured.slug}`}>{featured.title}</Link></h3><p>{featured.excerpt}</p><Link className="text-link" to={`/stories/${featured.slug}`}>Mở một trang chuyện <Icon name="arrow" /></Link></div>
      </article>
      <div className="journal-side-stories"><p className="journal-side-note">Có những câu chuyện chỉ cần một góc nhỏ.</p>{others.map((story, index) => <article className="journal-compact-story" key={story.slug}>
        <Link to={`/stories/${story.slug}`} className="journal-editorial-image journal-thumb"><img src={story.image} alt={story.alt} loading="lazy" width="1536" height="1024" /></Link>
        <div><p className="eyebrow"><span>{String(index + 2).padStart(2, '0')}</span> / {story.category}</p><h3><Link to={`/stories/${story.slug}`}>{story.title}</Link></h3><p className="journal-compact-excerpt">{story.excerpt}</p><Link className="journal-read-link" to={`/stories/${story.slug}`}>Đọc tiếp <Icon name="arrow" /></Link></div>
      </article>)}</div>
    </div>
  }
  return <div className="journal-grid">{stories.map(story => <article className="journal-card" key={story.slug}>
    <Link to={`/stories/${story.slug}`} className="journal-image"><img src={story.image} alt={story.alt} loading="lazy" width="1536" height="1024" /></Link>
    <p className="eyebrow">{story.category}</p><h3><Link to={`/stories/${story.slug}`}>{story.title}</Link></h3><p>{story.excerpt}</p><Link className="text-link" to={`/stories/${story.slug}`}>Đọc câu chuyện <Icon name="arrow" /></Link>
  </article>)}</div>
}

export function StoriesPage() {
  return <section className="stories-page container"><nav className="breadcrumbs" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><span aria-current="page">Chuyện của gốm</span></nav><div className="catalog-heading"><p className="eyebrow">NHẬT KÝ NHÀ NÀNG</p><h1>Chuyện gốm.<br /><em>Chuyện mình.</em></h1><p>Những ý tưởng nhỏ để thương nhà và thương những ngày bình thường.</p></div><StoryCards /></section>
}

export function StoryPage() {
  const { slug } = useParams()
  const story = stories.find(item => item.slug === slug)
  if (!story) return <section className="container empty-state not-found"><h1>Chưa tìm thấy câu chuyện này</h1><Link className="button primary" to="/stories">Về chuyện của gốm</Link></section>
  return <article className="reading-page">
    <div className="container"><nav className="breadcrumbs" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><Link to="/stories">Chuyện của gốm</Link></nav><header className="reading-heading"><p className="eyebrow">{story.category}</p><h1>{story.title}</h1><p>Một câu chuyện từ Nàng Gốm</p></header><img className="reading-hero" src={story.image} alt={story.alt} width="1536" height="1024" /></div>
    <div className="reading-body"><p className="reading-intro">{story.intro}</p>{story.sections.map(section => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}<p className="editorial-note">Nội dung cảm hứng cho bản giới thiệu Nàng Gốm. Ảnh AI minh họa; thông tin sản phẩm và dịch vụ cần được xác minh riêng.</p><Link className="button primary" to={`/products?category=${encodeURIComponent(story.productCategory)}`}>Khám phá những món gốm <Icon name="arrow" /></Link><Link className="back-to-stories text-link" to="/stories">Đọc thêm chuyện của Nàng <Icon name="arrow" /></Link></div>
  </article>
}
