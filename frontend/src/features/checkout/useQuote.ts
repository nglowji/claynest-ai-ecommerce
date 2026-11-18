import { useEffect, useState } from 'react'
import { catalogRequest } from '../../catalog/api'
import type { Cart } from '../cart/useCart'
import type { CartQuote } from './api'
export function useQuote(cart: Cart) {
  const [data,setData] = useState<CartQuote | null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const [attempt,setAttempt] = useState(0)
  const signature = JSON.stringify(Object.entries(cart).sort(([a],[b]) => a.localeCompare(b)))
  useEffect(() => {
    const controller = new AbortController(); const entries = JSON.parse(signature) as [string,number][]
    setData(null); setError(''); setLoading(entries.length > 0)
    if (!entries.length) return () => controller.abort()
    const timer = window.setTimeout(() => {
      catalogRequest<CartQuote>('cart/quote', { method: 'POST', body: JSON.stringify({ items: entries.map(([variantId,quantity]) => ({ variantId,quantity })) }), signal: controller.signal })
        .then(v => { if (!controller.signal.aborted) { setData(v); setLoading(false) } })
        .catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Chưa lấy được báo giá. Vui lòng thử lại.'); setLoading(false) } })
    }, 150)
    return () => { clearTimeout(timer); controller.abort() }
  }, [signature, attempt])
  return { data,error,loading,retry: () => setAttempt(n => n + 1) }
}
