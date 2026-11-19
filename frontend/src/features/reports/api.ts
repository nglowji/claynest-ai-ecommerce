import { catalogRequest } from '../../catalog/api'
export type SalesReport = {
  period: { from: string; to: string; grain: string; fromUtc: string; toExclusiveUtc: string }; generatedAt: string; timeZone: string; isDemo: boolean;
  metrics: { completedSalesVnd: string; productSalesVnd: string; shippingCollectedVnd: string; completedOrders: number; averageOrderValueVnd: string | null; grossPlacedOrderValueVnd: string; placedOrders: number };
  trend: { bucketStart: string; from: string; to: string; salesVnd: string; completedOrders: number }[];
  topVariants: { variantId: string; sku: string; productName: string; variantName: string; quantity: string; productSalesVnd: string }[];
  lowStockTotal: number; lowStock: { variantId: string; sku: string; productName: string; variantName: string; stockQty: number; threshold: number }[];
}
export const getSalesReport = (params: URLSearchParams,signal?: AbortSignal) => catalogRequest<SalesReport>('admin/reports?'+params,{ signal })
export function reportMoney(value: string): string {
  const [whole,fraction]=value.split('.')
  return new Intl.NumberFormat('vi-VN').format(BigInt(whole))+(fraction && /[1-9]/.test(fraction) ? ','+fraction.padEnd(2,'0') : '')+' ₫'
}
