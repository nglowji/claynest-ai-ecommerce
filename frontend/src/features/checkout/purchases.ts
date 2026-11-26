import { catalogRequest, type PageResult } from '../../catalog/api'
import type { Cart } from '../cart/useCart'
export type PurchaseItem = {
  variantId: string
  slug: string | null
  name: string
  variantName: string
  image: string
  quantity: number
  lineTotalVnd: number
  availableQty: number
}
export type Purchase = {
  reference: string
  status: string
  paymentStatus: string
  grandTotalVnd: number
  createdAt: string
  items: PurchaseItem[]
}
export type PurchaseHistory = {
  orders: PageResult<Purchase>
  counts: { status: string; count: number }[]
}
export const getPurchases = (params: URLSearchParams, signal: AbortSignal) =>
  catalogRequest<PurchaseHistory>('account/orders?' + params, { signal })
export function reorderCart(current: Cart, items: PurchaseItem[]) {
  const cart = { ...current }
  let added = 0
  for (const item of items) {
    if (
      !item.slug ||
      item.availableQty <= 0 ||
      (!cart[item.variantId] && Object.keys(cart).length >= 30)
    )
      continue
    const before = cart[item.variantId] || 0
    const after = Math.max(before, Math.min(99, item.availableQty, before + item.quantity))
    if (after > before) {
      cart[item.variantId] = after
      added += after - before
    }
  }
  return { cart, added }
}
export const purchaseLabels: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  packed: 'Đã đóng gói',
  shipped: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}
export const purchaseDate = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
