import type { CSSProperties } from 'react'
type Name = 'search' | 'bag' | 'arrow' | 'close' | 'menu' | 'leaf' | 'gift' | 'hand' | 'plus' | 'minus'
const paths: Record<Name, React.ReactNode> = {
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
