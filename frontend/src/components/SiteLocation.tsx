import Icon from './Icon'

const destination = 'Trường Đại học Trà Vinh, 126 Nguyễn Thiện Thành, Việt Nam'
const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&z=16&output=embed`
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`

export default function SiteLocation() {
  return <section id="location" className="location-section container" aria-labelledby="location-title">
    <div className="location-copy"><p className="eyebrow">MỘT ĐỊA ĐIỂM, MỘT CHÚT AN YÊN</p><h2 id="location-title">Ghé một góc<br /><em>bình yên.</em></h2>
      <div className="location-address"><span className="location-pin" aria-hidden="true"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span><div><h3>Trường Đại học Trà Vinh</h3><address>126 Nguyễn Thiện Thành,<br />phường Hòa Thuận, tỉnh Vĩnh Long.</address></div></div>
      <a className="location-directions" href={directionsUrl} target="_blank" rel="noopener noreferrer">Mở bản đồ & chỉ đường <Icon name="arrow" /><span className="sr-only"> (mở trong tab mới)</span></a>
      <p className="location-demo">Địa điểm minh họa cho Nàng Gốm.</p>
    </div>
    <div className="location-map"><iframe title="Bản đồ Trường Đại học Trà Vinh — 126 Nguyễn Thiện Thành" src={mapUrl} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><div className="location-map-caption"><span>ĐẠI HỌC TRÀ VINH</span><a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label="Mở chỉ đường đến Đại học Trà Vinh trong tab mới">Mở Google Maps ↗</a></div></div>
  </section>
}
