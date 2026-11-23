import { AuthError, getCsrfToken } from '../auth/api'
import type { CatalogProduct, Category } from '../data/products'
export type PageResult<T> = { items: T[]; page: number; pageSize: number; totalCount: number }
const REQUEST_TIMEOUT_MS = 15000

export async function catalogRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  try {
    signal.throwIfAborted()
    const headers = new Headers(options.headers)
    if (options.body && !(options.body instanceof FormData))
      headers.set('Content-Type', 'application/json')
    const method = (options.method || 'GET').toUpperCase()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers.set('X-CSRF-TOKEN', await getCsrfToken(signal))
    }
    // Cancellation during CSRF initialization must never send the mutation.
    signal.throwIfAborted()
    const response = await fetch('/api/v1/' + path, {
      ...options,
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const title =
        typeof body?.title === 'string' ? body.title : 'Chưa tải được dữ liệu. Vui lòng thử lại.'
      const code = typeof body?.code === 'string' ? body.code : undefined
      throw new AuthError(response.status, title, code)
    }
    return response.status === 204 ? (undefined as T) : await response.json()
  } catch (error) {
    if (options.signal?.aborted) throw error
    if (timeout.aborted) throw new AuthError(0, 'Dịch vụ phản hồi quá lâu. Vui lòng thử lại.')
    if (error instanceof AuthError) throw error
    throw new AuthError(0, 'Chưa kết nối được dịch vụ. Vui lòng thử lại.')
  }
}
export const getCategories = (admin = false) =>
  catalogRequest<Category[]>((admin ? 'admin/catalog/' : '') + 'categories')
export const getProducts = (params: URLSearchParams, admin = false, signal?: AbortSignal) =>
  catalogRequest<PageResult<CatalogProduct>>(
    (admin ? 'admin/catalog/' : '') + 'products?' + params,
    { signal },
  )
