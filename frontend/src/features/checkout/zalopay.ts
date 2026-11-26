import { catalogRequest } from '../../catalog/api'
import type { Receipt } from './api'
export type ZaloPayment = {
  reference: string
  state: 'created' | 'pending' | 'paid' | 'expired' | 'refund_required'
  paymentStatus: string
  amount: number
  qrPayload: string
  orderUrl: string
  expiresAt: string
  sandbox: boolean
}
export const paymentMethods = (signal: AbortSignal) =>
  catalogRequest<{ zaloPayEnabled: boolean; sandbox: boolean }>('payments/methods', { signal })
export const zaloPayment = (receipt: Receipt, create: boolean, signal: AbortSignal) =>
  catalogRequest<ZaloPayment>(`orders/${encodeURIComponent(receipt.reference)}/zalopay/`, {
    method: create ? 'POST' : 'GET',
    headers: receipt.accessToken ? { 'X-Order-Token': receipt.accessToken } : {},
    signal,
  })
const key = 'nang-gom-active-zalopay-v1'
export function activeZalo(): Receipt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null')
    return value?.paymentMethod === 'zalopay' &&
      typeof value.reference === 'string' &&
      /^[A-Z0-9-]{1,32}$/.test(value.reference) &&
      typeof value.accessToken === 'string' &&
      value.accessToken.length <= 128 &&
      Number.isSafeInteger(value.grandTotalVnd) &&
      value.grandTotalVnd > 0
      ? value
      : null
  } catch {
    return null
  }
}
export function rememberZalo(receipt: Receipt | null) {
  try {
    if (receipt) sessionStorage.setItem(key, JSON.stringify(receipt))
    else sessionStorage.removeItem(key)
  } catch {
    /* Current tab can still finish payment. */
  }
}
