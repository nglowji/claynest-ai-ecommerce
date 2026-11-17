export type Category = 'Tất cả' | 'Cốc & tách' | 'Bình hoa' | 'Bát & đĩa' | 'Bộ sưu tập'
export type Product = {
  id: number
  name: string
  category: Exclude<Category, 'Tất cả'>
  price: number
  image: string
  imageClass?: string
  note: string
  description: string
}
export const categories: Category[] = ['Tất cả', 'Cốc & tách', 'Bình hoa', 'Bát & đĩa', 'Bộ sưu tập']
export const products: Product[] = [
  { id: 1, name: 'Cặp cốc Mây', category: 'Cốc & tách', price: 320000, image: '/images/vase.jpg', note: 'Men trắng chấm', description: 'Hai chiếc cốc dáng tròn, sắc trắng ngà và những chấm men nhỏ. Một gợi ý cho góc bàn bình yên của bạn.' },
  { id: 2, name: 'Bình An Nhiên', category: 'Bình hoa', price: 480000, image: '/images/collection.jpg', imageClass: 'bottle-crop', note: 'Dáng cao · Trắng ngà', description: 'Dáng bình thanh mảnh với bề mặt mộc mạc. Thử kết hợp cùng một nhành lá hoặc để riêng như một điểm nhấn nhẹ nhàng.' },
  { id: 3, name: 'Bộ bát Mộc', category: 'Bát & đĩa', price: 560000, image: '/images/bowls.jpg', note: 'Bộ 4 · Men chấm tự nhiên', description: 'Bốn chiếc bát mang đường nét mềm và lớp men chấm nhã nhặn. Một bảng màu giản dị cho không gian sống.' },
  { id: 4, name: 'Bộ gốm Ngày Chậm', category: 'Bộ sưu tập', price: 690000, image: '/images/collection.jpg', note: 'Một bình & hai cốc', description: 'Bộ ba đồng điệu với sắc men trắng ngà. Một gợi ý quà tặng dành cho người yêu những điều mộc mạc.' },
]
export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
