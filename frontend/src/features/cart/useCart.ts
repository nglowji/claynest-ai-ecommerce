import { useEffect, useState } from 'react'
export type Cart = Record<string, number>
const key = 'nang-gom-cart-v1'
function restore(): Cart {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([id, qty]) => /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(qty) && qty >= 1 && qty <= 99).slice(0,30))
  } catch { return {} }
}
export function useCart() {
  const [quantities, set] = useState<Cart>(restore)
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(quantities)) } catch { /* The current tab can still shop without persistence. */ } }, [quantities])
  return {
    quantities, count: Object.values(quantities).reduce((n,q) => n + q, 0),
    add(id: string, available: number) { set(current => Object.keys(current).length >= 30 && !current[id] ? current : { ...current, [id]: Math.min(99, available, (current[id] || 0) + 1) }) },
    change(id: string, delta: number) { set(current => { const next = { ...current }; const qty = Math.min(99, Math.max(0, (next[id] || 0) + delta)); if (qty) next[id] = qty; else delete next[id]; return next }) },
    remove(id: string) { set(current => { const next = { ...current }; delete next[id]; return next }) },
    clear() { set({}) },
  }
}
