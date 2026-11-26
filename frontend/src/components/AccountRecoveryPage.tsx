import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { accountRequest } from '../auth/accountApi'
import { useAuth } from '../auth/AuthContext'

export default function AccountRecoveryPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const reset = location.pathname === '/reset-password'
  const verify = location.pathname === '/verify-email'
  const resend = location.pathname === '/request-verification'
  const [credentials] = useState(() => {
    const fields = new URLSearchParams(window.location.hash.slice(1))
    return { userId: fields.get('user') || '', token: fields.get('token') || '' }
  })
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true })
  }, [])
  const validLink = !!credentials.userId && !!credentials.token && credentials.token.length <= 4096
  const [email, setEmail] = useState(auth.user?.email || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (reset && password !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (reset) {
        await accountRequest('reset-password', { ...credentials, newPassword: password })
        setPassword('')
        setConfirmation('')
        auth.expire()
        setNotice(
          'Đã đặt lại mật khẩu. Các phiên đăng nhập cũ đã hết hiệu lực. Bạn có thể đăng nhập bằng mật khẩu mới.',
        )
      } else if (verify) {
        await accountRequest('confirm-email', credentials)
        if (auth.user) await auth.refresh()
        setNotice('Email đã được xác minh. Cảm ơn bạn đã hoàn thiện tài khoản.')
      } else {
        const result = await accountRequest<{ message: string }>(
          resend ? 'request-verification' : 'forgot-password',
          { email: email.trim() },
        )
        setNotice(result.message)
      }
      setDone(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa xử lý được yêu cầu.')
    } finally {
      setBusy(false)
    }
  }
  const title = reset
    ? 'Đặt lại mật khẩu'
    : verify
      ? 'Xác minh email'
      : resend
        ? 'Gửi lại email xác minh'
        : 'Quên mật khẩu?'
  return (
    <section className="account-recovery container" aria-labelledby="recovery-title">
      <div className="account-recovery-card">
        <Link className="auth-back" to="/login">
          ← Đăng nhập
        </Link>
        <p className="eyebrow">TÀI KHOẢN NÀNG GỐM</p>
        <h1 id="recovery-title">{title}</h1>
        <p>
          {reset
            ? 'Chọn một mật khẩu mới để bảo vệ góc nhỏ của bạn.'
            : verify
              ? 'Xác nhận địa chỉ email gắn với tài khoản của bạn.'
              : 'Nhập địa chỉ email đăng ký. Nàng sẽ gửi hướng dẫn đến hộp thư của bạn.'}
        </p>
        {(reset || verify) && !validLink ? (
          <div role="alert">
            <p>Liên kết thiếu thông tin hoặc không còn khả dụng.</p>
            <Link to={verify ? '/request-verification' : '/forgot-password'}>
              Yêu cầu liên kết mới
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {!done && (
              <fieldset disabled={busy}>
                {!reset && !verify && (
                  <label>
                    Email
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                )}
                {reset && (
                  <>
                    <p className="account-help">
                      Ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
                    </p>
                    <label>
                      Mật khẩu mới
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={256}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    <label>
                      Xác nhận mật khẩu mới
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={256}
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <button className="button primary" disabled={busy}>
                  {busy
                    ? 'Đang xử lý…'
                    : reset
                      ? 'Lưu mật khẩu mới'
                      : verify
                        ? 'Xác nhận email'
                        : 'Gửi hướng dẫn'}
                </button>
              </fieldset>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="account-notice" role="status">
                {notice}
              </p>
            )}
            {done && (
              <Link
                className="text-link"
                to={
                  auth.user
                    ? auth.user.role === 'Admin'
                      ? '/admin/account'
                      : '/account'
                    : '/login'
                }
              >
                {auth.user ? 'Về tài khoản' : 'Đến trang đăng nhập'} →
              </Link>
            )}
            {done && !reset && !verify && (
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  setDone(false)
                  setNotice('')
                }}
              >
                Dùng email khác
              </button>
            )}
            {error && (reset || verify) && (
              <Link
                className="text-link"
                to={verify ? '/request-verification' : '/forgot-password'}
              >
                Yêu cầu liên kết mới
              </Link>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
