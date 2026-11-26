import { useEffect, useState } from 'react'
import { AuthError } from '../../auth/api'
import { getSalesReport, type SalesReport } from './api'
import { previousDay } from './utils'
export function useReports(query: string, revision: number, expire: () => void) {
  const [report, setReport] = useState<SalesReport | null>(null)
  const [previous, setPrevious] = useState<SalesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')
  const [comparisonError, setComparisonError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setReport(null)
    setPrevious(null)
    setError('')
    setComparisonError('')
    setComparing(false)
    async function load() {
      let current: SalesReport
      try {
        current = await getSalesReport(new URLSearchParams(query), controller.signal)
        if (controller.signal.aborted) return
        setReport(current)
        setLoading(false)
      } catch (failure) {
        if (controller.signal.aborted) return
        if (failure instanceof AuthError && failure.status === 401) expire()
        setError(failure instanceof Error ? failure.message : 'Chưa tải được báo cáo.')
        setLoading(false)
        return
      }
      const length =
        Math.round((Date.parse(current.period.to) - Date.parse(current.period.from)) / 86400000) + 1
      const from = previousDay(current.period.from, length),
        to = previousDay(current.period.from, 1)
      if (from < '2000-01-01') {
        setComparisonError('Kỳ trước nằm ngoài phạm vi dữ liệu hỗ trợ.')
        return
      }
      setComparing(true)
      try {
        const result = await getSalesReport(
          new URLSearchParams({ from, to, grain: current.period.grain }),
          controller.signal,
        )
        if (!controller.signal.aborted) setPrevious(result)
      } catch (failure) {
        if (controller.signal.aborted) return
        if (failure instanceof AuthError && failure.status === 401) expire()
        setComparisonError('Chưa tải được kỳ trước. Số liệu kỳ đang xem vẫn sử dụng được.')
      } finally {
        if (!controller.signal.aborted) setComparing(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [query, revision])
  return { report, previous, loading, comparing, error, comparisonError }
}
