import type { CatalogProduct, Variant } from '../data/products'
export default function ProductFacts({
  product,
  variant,
}: {
  product: CatalogProduct
  variant: Variant
}) {
  const format = (value: number) => value.toLocaleString('vi-VN')
  const facts = [
    ['Chất liệu', product.material],
    ['Men / màu', variant.glaze],
    ['Chiều rộng', variant.widthCm ? `${format(variant.widthCm)} cm` : ''],
    ['Chiều cao', variant.heightCm ? `${format(variant.heightCm)} cm` : ''],
    ['Dung tích', variant.capacityMl ? `${format(variant.capacityMl)} ml` : ''],
    ['Khối lượng', variant.weightG ? `${format(variant.weightG)} g` : ''],
    ['Công dụng', variant.intendedUse],
    ['Mã sản phẩm', variant.sku],
  ].filter(([, value]) => value)
  return (
    <section className="product-facts" aria-labelledby="product-facts-title">
      <h2 id="product-facts-title">Thông tin món gốm</h2>
      <dl className="product-specs">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {product.handmadeNote && <p className="detail-note">{product.handmadeNote}</p>}
      {product.craftStory && (
        <details open>
          <summary>Câu chuyện của món gốm</summary>
          <p>{product.craftStory}</p>
        </details>
      )}
      <details>
        <summary>Chăm sóc &amp; sử dụng</summary>
        <p>
          {(variant.careVerified && variant.careNote) ||
            'Liên hệ Nàng để được hướng dẫn bảo quản phù hợp với món gốm này.'}
        </p>
      </details>
    </section>
  )
}
