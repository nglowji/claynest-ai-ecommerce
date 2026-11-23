import type { ReactNode } from 'react'
export type AdminIconName =
  | 'assistant'
  | 'reports'
  | 'download'
  | 'knowledge'
  | 'overview'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'truck'
  | 'refresh'
  | 'external'
  | 'arrow'
  | 'logout'
  | 'check'
  | 'clock'
const paths: Record<AdminIconName, ReactNode> = {
  assistant: (
    <>
      <path d="M4 4h16v12H9l-5 4V4Z" />
      <path d="M8 8h8M8 12h5" />
    </>
  ),
  reports: (
    <>
      <path d="M3 3v18h18M7 16v-4M12 16V8M17 16V5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  knowledge: (
    <>
      <path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-1-7-2-10 1ZM12 5v15M5 8h3M5 12h3M16 8h3M16 12h3" />
    </>
  ),
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  products: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" />
    </>
  ),
  inventory: (
    <>
      <path d="m3 8 9-5 9 5v13H3V8ZM7 21V11h10v10M7 15h10M7 18h10" />
    </>
  ),
  orders: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" />
    </>
  ),
  truck: (
    <>
      <path d="M2 5h12v12H2V5ZM14 10h4l4 4v3h-8M14 14h8" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M21 21v-5h-5" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  logout: (
    <>
      <path d="M9 4H4v16h5M9 12h12m-5-5 5 5-5 5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
}
export default function AdminIcon({ name }: { name: AdminIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
