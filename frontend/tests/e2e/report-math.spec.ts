import { test, expect } from '@playwright/test'
import { reportChange } from '../../src/features/reports/utils'
test('report comparison retains integer precision and handles missing and zero bases', () => {
  expect(reportChange('990791918021509230', '900719925474099300')).toBe(
    'Tăng 10,00% so với kỳ trước',
  )
  expect(reportChange('1', '2')).toBe('Giảm 50,00% so với kỳ trước')
  expect(reportChange('0', '0')).toBe('Không thay đổi')
  expect(reportChange('100', '0')).toBe('Kỳ trước bằng 0')
  expect(reportChange('100', null)).toBe('Chưa đủ dữ liệu so sánh')
  expect(reportChange('10.50', '10')).toBe('Tăng 5,00% so với kỳ trước')
})
