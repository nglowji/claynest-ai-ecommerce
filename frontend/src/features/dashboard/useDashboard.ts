import { useEffect, useState } from 'react'
import { AuthError } from '../../auth/api'
import { catalogRequest, type PageResult } from '../../catalog/api'
import { listOrders, type OrderRow } from '../orders/adminApi'
import { getSalesReport, type SalesReport } from '../reports/api'

export type DashboardSummary = {
  products: number
  pending: number
  confirmed: number
  packed: number
  shipped: number
  lowStock: number
  recent: OrderRow[]
}
export type DashboardPeriod = '7' | '30' | '90'
export function dashboardPeriod(value: string | null): DashboardPeriod {
  return value === '7' || value === '90' ? value : '30'
}
export function reportPeriod(days: DashboardPeriod) {
  const end = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const to = end.toISOString().slice(0, 10)
  end.setUTCDate(end.getUTCDate() - Number(days) + 1)
  return new URLSearchParams({ from: end.toISOString().slice(0, 10), to, grain: 'day' })
}

type LoadState<T> = { data: T | null; loading: boolean; error: string; updatedAt: Date | null }
const initial = <T>(): LoadState<T> => ({ data: null, loading: true, error: '', updatedAt: null })

export function useDashboard(period: DashboardPeriod, onExpired: () => void) {
  const [attempt, setAttempt] = useState(0)
  const [summary, setSummary] = useState(initial<DashboardSummary>)
  const [report, setReport] = useState(initial<SalesReport>)
  // Capture a fixed Vietnam calendar range for this render, including midnight changes.
  const query = reportPeriod(period).toString()
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    const orders = (status?: string) =>
      listOrders(
        new URLSearchParams({
          page: '1',
          pageSize: status ? '1' : '6',
          ...(status ? { status } : {}),
        }),
        signal,
      )
    setSummary(initial())
    Promise.all([
      catalogRequest<PageResult<unknown>>('admin/catalog/products?page=1&pageSize=1', { signal }),
      orders('pending'),
      orders('confirmed'),
      orders('packed'),
      orders('shipped'),
      catalogRequest<PageResult<unknown>>('admin/inventory/?lowOnly=true&page=1&pageSize=1', {
        signal,
      }),
      orders(),
    ])
      .then(([products, pending, confirmed, packed, shipped, stock, recent]) => {
        if (signal.aborted) return
        setSummary({
          data: {
            products: products.totalCount,
            pending: pending.totalCount,
            confirmed: confirmed.totalCount,
            packed: packed.totalCount,
            shipped: shipped.totalCount,
            lowStock: stock.totalCount,
            recent: recent.items,
          },
          loading: false,
          error: '',
          updatedAt: new Date(),
        })
      })
      .catch((error) => {
        if (signal.aborted) return
        if (error instanceof AuthError && error.status === 401) onExpired()
        setSummary({
          data: null,
          loading: false,
          error: 'Chưa tải được hoạt động cửa hàng. Vui lòng thử lại.',
          updatedAt: null,
        })
      })
    return () => controller.abort()
    // AuthProvider recreates expire; request lifetime follows the explicit reload only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])
  useEffect(() => {
    const controller = new AbortController()
    setReport(initial())
    getSalesReport(new URLSearchParams(query), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setReport({ data, loading: false, error: '', updatedAt: new Date() })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        if (error instanceof AuthError && error.status === 401) onExpired()
        setReport({
          data: null,
          loading: false,
          error: 'Chưa tải được doanh thu trong kỳ. Các tác vụ cửa hàng vẫn sử dụng được.',
          updatedAt: null,
        })
      })
    return () => controller.abort()
  }, [query, attempt])
  return { summary, report, query, refresh: () => setAttempt((value) => value + 1) }
}
