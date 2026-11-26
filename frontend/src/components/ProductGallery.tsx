import { useEffect, useRef, useState } from 'react'
import SiteImage from './SiteImage'
import Icon from './Icon'
import type { Image } from '../data/products'
export default function ProductGallery({
  images,
  initial,
  name,
}: {
  images: Image[]
  initial: string
  name: string
}) {
  const [active, setActive] = useState(initial)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => setActive(initial), [initial])
  const chosen = images.find((image) => image.url === active) || images[0]
  if (!chosen) return <div className="product-photo-empty">Ảnh sản phẩm đang được cập nhật.</div>
  return (
    <div className="product-gallery product-gallery-v2">
      <button
        className="product-photo-open"
        onClick={() => dialog.current?.showModal()}
        aria-label={'Phóng to ảnh ' + name}
      >
        <SiteImage
          src={chosen.url}
          alt={chosen.alt || name}
          width={720}
          height={720}
          fetchPriority="high"
        />
        <span>Phóng to ảnh ↗</span>
      </button>
      <div className="product-thumbnails" aria-label="Ảnh sản phẩm">
        {images.map((image, index) => (
          <button
            key={image.id || image.url}
            onClick={() => setActive(image.url)}
            aria-pressed={image.url === chosen.url}
            aria-label={'Xem ảnh ' + (image.alt || `${name} ${index + 1}`)}
          >
            <SiteImage src={image.url} alt={image.alt || name} width={80} height={80} />
          </button>
        ))}
      </div>
      <dialog
        className="product-lightbox"
        ref={dialog}
        aria-label={'Ảnh phóng to ' + name}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
      >
        <button aria-label="Đóng ảnh phóng to" onClick={() => dialog.current?.close()}>
          <Icon name="close" />
        </button>
        <SiteImage src={chosen.url} alt={chosen.alt || name} />
      </dialog>
    </div>
  )
}
