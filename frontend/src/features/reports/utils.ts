export function todayVN() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
export function previousDay(date: string, days: number) {
  const value = new Date(date + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}
export const fullDate = (date: string) =>
  date.slice(8, 10) + '/' + date.slice(5, 7) + '/' + date.slice(0, 4)
export const reportNumber = (value: number) => value.toLocaleString('vi-VN')
export const reportQuantity = (value: string) =>
  new Intl.NumberFormat('vi-VN').format(BigInt(value))
// Monetary comparisons use hundredths as integers, including rounded average order values.
const hundredths = (value: string) => {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
}
export function reportChange(current: string, previous: string | null) {
  if (previous === null) return 'Chưa đủ dữ liệu so sánh'
  const before = hundredths(previous),
    now = hundredths(current)
  if (before === 0n) return now === 0n ? 'Không thay đổi' : 'Kỳ trước bằng 0'
  const basisPoints = ((now - before) * 10000n) / before
  if (basisPoints === 0n) return 'Không thay đổi đáng kể'
  const abs = basisPoints < 0n ? -basisPoints : basisPoints
  const percent = `${abs / 100n},${String(abs % 100n).padStart(2, '0')}`
  return `${basisPoints > 0n ? 'Tăng' : 'Giảm'} ${percent}% so với kỳ trước`
}
