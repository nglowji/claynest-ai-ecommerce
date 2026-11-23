import { Link } from 'react-router-dom'

export default function Brand() {
  return (
    <Link className="brand nang-gom-brand" to="/" aria-label="Nàng Gốm — Trang chủ">
      <svg
        className="brand-emblem"
        viewBox="0 0 52 58"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 27h12l-1 6c0 5 9 7 9 14 0 6-6 8-14 8s-14-2-14-8c0-7 9-9 9-14l-1-6Z" />
        <path d="M19 27h14M15 47c7 3 15 3 22 0M26 26V13M26 21c-7 0-9-7-9-7 7 0 9 7 9 7ZM26 17c7 0 9-7 9-7-7 0-9 7-9 7Z" />
        <circle cx="26" cy="6" r="3" />
        <path d="M10 10 8 8M42 10l2-2M6 22H3M46 22h3" />
      </svg>
      <span className="brand-type">
        <span className="brand-name">Nàng Gốm</span>
        <span className="brand-tagline">GỐM MỘC & CHUYỆN NHÀ</span>
      </span>
    </Link>
  )
}
