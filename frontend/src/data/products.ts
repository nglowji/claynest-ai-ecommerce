export type Category = 'Tất cả' | 'Cốc & tách' | 'Bình hoa' | 'Bát & đĩa' | 'Bộ sưu tập'
export type Product = {
  id: number
  name: string
  category: Exclude<Category, 'Tất cả'>
  price: number
  originalPrice?: number
  label?: string
  image: string
  imageClass?: string
  note: string
  description: string
}
export const categories: Category[] = ['Tất cả', 'Cốc & tách', 'Bình hoa', 'Bát & đĩa', 'Bộ sưu tập']
export const products: Product[] = [
  { id: 1, name: 'Cốc Sương Mai', category: 'Cốc & tách', price: 280000, originalPrice: 350000, label: 'HOT SALE', image: '/images/slow-living/cup.jpg', note: 'Xanh sage · Dáng tròn', description: 'Một chiếc cốc xanh dịu với quai tròn và bề mặt men chấm nhẹ. Gợi nhớ tách cà phê ấm trong một buổi sáng không vội.' },
  { id: 2, name: 'Bình Nắng Nhẹ', category: 'Bình hoa', price: 420000, originalPrice: 560000, label: 'NÀNG CHỌN', image: '/images/slow-living/vase.jpg', note: 'Đất nung · Dáng bầu', description: 'Sắc đất ấm, một vệt xanh ngẫu hứng và dáng bình mềm mại. Chỉ cần thêm vài cành hoa khô, góc nhà đã có một câu chuyện riêng.' },
  { id: 3, name: 'Bát Mây Ngà', category: 'Bát & đĩa', price: 240000, label: 'MỚI', image: '/images/slow-living/bowl.jpg', note: 'Men ngà · Viền tự nhiên', description: 'Chiếc bát nông màu ngà, viền hơi lượn và những chấm men nâu nhỏ. Một gợi ý nhẹ nhàng cho chiếc bàn bạn yêu.' },
  { id: 4, name: 'Bộ trà Thảnh Thơi', category: 'Bộ sưu tập', price: 790000, originalPrice: 1000000, label: 'HOT SALE', image: '/images/slow-living/tea.jpg', note: 'Một ấm & hai tách · Men kem', description: 'Một ấm tròn có quai tre và hai tách nhỏ trên khay gỗ. Gợi ý cho những buổi chuyện trò chậm rãi hoặc một lời quan tâm gửi người thân.' },
]

export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export const isOnSale = (product: Product) => typeof product.originalPrice === 'number' && product.originalPrice > product.price
export const discountPercent = (product: Product) => isOnSale(product) ? Math.round((1 - product.price / product.originalPrice!) * 100) : 0
export const maxDiscount = Math.max(0, ...products.map(discountPercent))
