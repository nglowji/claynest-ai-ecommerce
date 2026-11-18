import { AuthError } from '../auth/api'
import type { CatalogProduct, Category } from '../data/products'
export type PageResult<T> = { items: T[]; page: number; pageSize: number; totalCount: number }
export async function catalogRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (options.method && options.method !== 'GET') {
    const response = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new AuthError(response.status, 'Chưa khởi tạo được phiên bảo mật.')
    headers.set('X-CSRF-TOKEN', (await response.json()).requestToken)
  }
  const response = await fetch('/api/v1/' + path, { ...options, headers, credentials: 'same-origin', cache: 'no-store', signal: options.signal || AbortSignal.timeout(15000) })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new AuthError(response.status, body.title || 'Chưa tải được dữ liệu. Vui lòng thử lại.')
  }
  return response.status === 204 ? undefined as T : response.json()
}
export const getCategories = (admin = false) => catalogRequest<Category[]>((admin ? 'admin/catalog/' : '') + 'categories')
export const getProducts = (params: URLSearchParams, admin = false, signal?: AbortSignal) => catalogRequest<PageResult<CatalogProduct>>((admin ? 'admin/catalog/' : '') + 'products?' + params, { signal })
