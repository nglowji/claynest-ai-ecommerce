import { catalogRequest, type PageResult } from '../../catalog/api'
import type { Contact, OrderStatus } from '../checkout/api'
export const orderLabels: Record<string,string> = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', packed: 'Đã đóng gói', shipped: 'Đang giao hàng', completed: 'Hoàn tất', cancelled: 'Đã hủy' }
export const actionLabels: Record<string,string> = { confirmed: 'Xác nhận đơn', packed: 'Xác nhận đóng gói', shipped: 'Bàn giao vận chuyển', completed: 'Hoàn tất & ghi nhận COD', cancelled: 'Hủy đơn & hoàn kho' }
export type OrderRow = { id: string; reference: string; customerName: string; province: string; status: string; paymentStatus: string; grandTotalVnd: number; itemCount: number; createdAt: string; revision: number }
export type OrderEvent = { id: string; sequence: number; fromStatus: string; toStatus: string; reason: string; actorId: string | null; actorName: string; createdAt: string }
export type AdminOrder = { id: string; reference: string; status: string; paymentStatus: string; subtotalVnd: number; shippingFeeVnd: number; grandTotalVnd: number; createdAt: string; updatedAt: string; completedAt: string | null; cancelledAt: string | null; restockedAt: string | null; revision: number; contact: Contact; items: OrderStatus['items']; history: OrderEvent[]; allowedTransitions: string[] }
export type Transition = { status: string; revision: number; reason: string; requestId: string; confirmCodCollected: boolean }
export const listOrders = (params: URLSearchParams, signal?: AbortSignal) => catalogRequest<PageResult<OrderRow>>('admin/orders/?' + params, { signal })
export const getOrder = (id: string, signal?: AbortSignal) => catalogRequest<AdminOrder>('admin/orders/' + id, { signal })
export const transitionOrder = (id: string, input: Transition) => catalogRequest<AdminOrder>(`admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(input) })
