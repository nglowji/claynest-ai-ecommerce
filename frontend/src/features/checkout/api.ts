import { catalogRequest } from '../../catalog/api'
export type QuoteLine = { variantId: string; quantity: number; name: string; variantName: string; sku: string; slug: string; image: string; unitPriceVnd: number; originalPriceVnd: number | null; lineTotalVnd: number; availableQty: number; issue: string | null }
export type CartQuote = { items: QuoteLine[]; subtotalVnd: number; shippingFeeVnd: number; grandTotalVnd: number; canCheckout: boolean; quoteToken: string | null; expiresAt: string; shippingPolicy: string; packingNote: string }
export type Contact = { name: string; phone: string; email: string; province: string; address: string; note: string }
export type Checkout = { quoteToken: string; contact: Contact; acceptTerms: boolean }
export type Receipt = { reference: string; accessToken: string; accessExpiresAt: string; grandTotalVnd: number; status: string }
export type OrderStatus = { reference: string; status: string; paymentMethod: string; paymentStatus: string; subtotalVnd: number; shippingFeeVnd: number; grandTotalVnd: number; createdAt: string; contact: Contact; items: { sku: string; productName: string; variantName: string; image: string; quantity: number; unitPriceVnd: number; lineTotalVnd: number }[] }
export const placeOrder = (key: string, command: Checkout) => catalogRequest<Receipt>('orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(command) })
export const lookupOrder = (reference: string, token: string) => catalogRequest<OrderStatus>(`orders/${encodeURIComponent(reference)}/status`, { headers: token ? { 'X-Order-Token': token } : {} })
export function saveReceipt(receipt: Receipt) { try { sessionStorage.setItem('nang-gom-order-' + receipt.reference, JSON.stringify(receipt)) } catch { /* Confirmation also receives the access token through router state. */ } }
export function savedToken(reference: string): string { try { const value = JSON.parse(sessionStorage.getItem('nang-gom-order-' + reference) || '{}').accessToken; return typeof value === 'string' ? value : '' } catch { return '' } }
