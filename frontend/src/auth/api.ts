export type AdminUser = {
  id: string
  email: string
  displayName: string
  role: 'Admin' | 'Customer'
  emailConfirmed?: boolean
}
export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

async function request(path: string, options: RequestInit = {}) {
  try {
    return await fetch(path.startsWith('/api/') ? path : `/api/v1/auth${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new AuthError(0, 'Chưa kết nối được dịch vụ đăng nhập. Vui lòng thử lại.')
  }
}
function profile(value: unknown): AdminUser {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('email' in value) ||
    !('displayName' in value) ||
    !('role' in value) ||
    typeof value.id !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.displayName !== 'string' ||
    (value.role !== 'Admin' && value.role !== 'Customer')
  )
    throw new AuthError(500, 'Dữ liệu tài khoản chưa hợp lệ. Vui lòng thử lại.')
  return value as AdminUser
}
async function ensureSuccess(response: Response) {
  if (response.ok) return
  if (response.status === 429)
    throw new AuthError(429, 'Bạn đã thử quá nhiều lần. Vui lòng chờ một phút rồi thử lại.')
  if (response.status === 401)
    throw new AuthError(401, 'Email hoặc mật khẩu không đúng, hoặc tài khoản đang tạm khóa.')
  if (response.status === 400)
    throw new AuthError(400, 'Thông tin hoặc phiên bảo mật chưa hợp lệ. Vui lòng thử lại.')
  throw new AuthError(response.status, 'Dịch vụ đăng nhập chưa sẵn sàng. Vui lòng thử lại sau.')
}
export async function getCsrfToken(signal?: AbortSignal) {
  const response = await request('/csrf', { signal })
  await ensureSuccess(response)
  const data: unknown = await response.json()
  if (
    !data ||
    typeof data !== 'object' ||
    !('requestToken' in data) ||
    typeof data.requestToken !== 'string'
  )
    throw new AuthError(500, 'Chưa khởi tạo được phiên bảo mật.')
  return data.requestToken
}
export async function adminSession() {
  const response = await request('/api/v1/admin/session')
  await ensureSuccess(response)
  return profile(await response.json())
}
export async function currentUser() {
  const response = await request('/me')
  if (response.status === 401) return null
  await ensureSuccess(response)
  return profile(await response.json())
}
export async function signIn(email: string, password: string, rememberMe: boolean) {
  const token = await getCsrfToken()
  const response = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
    body: JSON.stringify({ email, password, rememberMe }),
  })
  await ensureSuccess(response)
  return profile(await response.json())
}
export async function signOut() {
  const token = await getCsrfToken() // Tokens are tied to the currently signed-in principal.
  const response = await request('/logout', { method: 'POST', headers: { 'X-CSRF-TOKEN': token } })
  if (response.status !== 401) await ensureSuccess(response)
}

export async function register(displayName: string, email: string, password: string) {
  const token = await getCsrfToken()
  const response = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token },
    body: JSON.stringify({ displayName, email, password }),
  })
  if (response.status === 400)
    throw new AuthError(
      400,
      'Chưa thể tạo tài khoản. Hãy dùng email khác và mật khẩu đủ 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.',
    )
  await ensureSuccess(response)
}
