export type Variant = {
  id: string; sku: string; name: string; glaze: string; intendedUse: string; capacityMl: number | null
  widthCm: number | null; heightCm: number | null; weightG: number | null; priceVnd: number
  originalPriceVnd: number | null; discountPercent: number; stockQty: number; active: boolean
  careNote: string; careSource: string; careVerified: boolean
}
export type Image = { id?: string; url: string; alt: string; sortOrder?: number; variantId?: string | null }
export type CatalogProduct = {
  id: string; categoryId: string; category: string; name: string; slug: string; description: string
  craftStory: string; material: string; handmadeNote: string; label: string; published: boolean
  sourceUrl: string; sourceName: string; sourceDimensions: string; sourceAvailability: string; priceUnit: string
  archived: boolean; isDemo: boolean; revision: string; updatedAt: string; variants: Variant[]; images: Image[]
}
export type Product = CatalogProduct & { price: number; originalPrice?: number; image: string; note: string; variantId: string; stockQty: number; discount: number }
export type Category = { id: string; name: string; slug: string; active: boolean; revision: string }
export function productView(p: CatalogProduct, selected?: Variant): Product {
  const v = selected || [...p.variants].filter(v => v.active).sort((a, b) => a.priceVnd - b.priceVnd || a.sku.localeCompare(b.sku))[0]
  return { ...p, price: v?.priceVnd || 0, originalPrice: v?.originalPriceVnd || undefined,
    image: p.images.find(i => i.variantId === v?.id)?.url || p.images[0]?.url || '/images/slow-living/bowl.jpg',
    note: [v?.glaze, v?.name].filter(Boolean).join(' · '), variantId: v?.id || '', stockQty: v?.stockQty || 0, discount: v?.discountPercent || 0 }
}
export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
export const isOnSale = (p: Product) => !!p.originalPrice && p.originalPrice > p.price
export const discountPercent = (p: Product) => p.discount
