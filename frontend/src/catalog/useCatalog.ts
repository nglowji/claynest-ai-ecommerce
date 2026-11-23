import { useEffect, useState } from 'react'
import { getProducts, type PageResult } from './api'
import type { CatalogProduct } from '../data/products'
export function useCatalog(query: string) {
  const [data, setData] = useState<PageResult<CatalogProduct> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    // Debounce filters; abort stale responses when a newer query starts.
    const timer = window.setTimeout(() => {
      getProducts(new URLSearchParams(query), false, abort.signal)
        .then((value) => {
          if (!abort.signal.aborted) setData(value)
        })
        .catch(() => {
          if (!abort.signal.aborted) setError('Chưa tải được sản phẩm. Bạn thử lại nhé.')
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false)
        })
    }, 200)
    return () => {
      abort.abort()
      window.clearTimeout(timer)
    }
  }, [query, attempt])
  return { data, loading, error, retry: () => setAttempt((value) => value + 1) }
}
