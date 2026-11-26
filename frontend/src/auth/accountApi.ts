import { AuthError, getCsrfToken, type AdminUser } from './api'
export async function accountRequest<T = void>(
  path: string,
  body: object,
  method = 'POST',
): Promise<T> {
  const token = await getCsrfToken()
  let response: Response
  try {
    response = await fetch('/api/v1/auth/' + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AuthError(0, 'Chưa kết nối được dịch vụ. Vui lòng thử lại.')
  }
  if (!response.ok) {
    let message =
      response.status === 401
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : response.status === 429
          ? 'Bạn đã gửi nhiều yêu cầu. Vui lòng chờ một phút rồi thử lại.'
          : 'Chưa xử lý được yêu cầu. Vui lòng thử lại.'
    if (response.status === 400) {
      const error = await response.json().catch(() => null)
      if (typeof error?.title === 'string') message = error.title
    }
    throw new AuthError(response.status, message)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
export const updateProfile = (displayName: string) =>
  accountRequest<AdminUser>('profile', { displayName }, 'PUT')
