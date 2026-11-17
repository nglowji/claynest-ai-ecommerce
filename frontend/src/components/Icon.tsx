import type { CSSProperties } from 'react'
type Name = 'search' | 'bag' | 'arrow' | 'close' | 'menu' | 'leaf' | 'gift' | 'hand' | 'plus' | 'minus' | 'heart' | 'cup' | 'vase' | 'tea' | 'user' | 'eye' | 'eye-off'
const paths: Record<Name, React.ReactNode> = {
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <><path d="m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7s-1 2-3 3.8M6 6.6C3.4 8.7 2 12 2 12s3.5 7 10 7a11 11 0 0 0 5-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  cup: <><path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8ZM16 9h2a3 3 0 0 1 0 6h-2M7 3v2M11 2v3M3 23h15"/></>,
  vase: <><path d="M10 8H8c0 4-4 6-4 10s16 4 16 0-4-6-4-10h-2M8 8h8M12 8V1M12 5c-4 0-5-3-5-3 4 0 5 3 5 3ZM12 4c4 0 5-3 5-3-4 0-5 3-5 3Z"/></>,
  tea: <><path d="M7 9h11v8a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V9ZM7 11 2 9l2 7h3M18 11h2a3 3 0 0 1 0 6h-2M6 9h13M10 6h5M12.5 3v3"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  bag: <><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  leaf: <><path d="M20 3C8 2 2 7 5 15c8 5 15-1 15-12Z"/><path d="M3 21 15 9"/></>,
  gift: <><path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14"/><path d="M12 7C3 7 5 0 9 3l3 4c9 0 7-7 3-4l-3 4Z"/></>,
  hand: <><path d="m4 15 4 5h8l5-7a2 2 0 0 0-3-2l-3 3V4a1.5 1.5 0 0 0-3 0v8-9a1.5 1.5 0 0 0-3 0v9-6a1.5 1.5 0 0 0-3 0v8l-2-2a1.5 1.5 0 0 0-2 2l2 1Z"/></>,
  plus: <path d="M5 12h14M12 5v14"/>,
  minus: <path d="M5 12h14"/>,
}
export default function Icon({ name, style }: { name: Name; style?: CSSProperties }) {
  return <svg style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
