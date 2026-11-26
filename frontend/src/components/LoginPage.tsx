import SiteImage from './SiteImage'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { register } from '../auth/api'
import Icon from './Icon'

export default function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const signingUp = location.pathname === '/register'
  const next = new URLSearchParams(location.search).get('next')
  const returnTo = next && ['/checkout', '/account/orders'].includes(next) ? next : '/account'
  const suffix = returnTo === '/account' ? '' : '?next=' + encodeURIComponent(returnTo)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(() => {
    if (typeof location.state?.notice === 'string') return location.state.notice
    try {
      return sessionStorage.getItem('nang-gom-account-notice') || ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      sessionStorage.removeItem('nang-gom-account-notice')
    } catch {
      /* Optional success notice. */
    }
  }, [])
  if (auth.user) return <Navigate to={auth.user.role === 'Admin' ? '/admin' : returnTo} replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    setNotice('')
    if (signingUp && password !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    setPending(true)
    try {
      if (signingUp) {
        await register(name.trim(), email.trim(), password)
        setPassword('')
        setConfirmation('')
        setNotice('Tài khoản đã sẵn sàng. Đăng nhập để ghé góc nhỏ của bạn.')
        navigate('/login' + suffix, { replace: true })
      } else {
        const user = await auth.login(email.trim(), password, remember)
        setPassword('')
        navigate(user.role === 'Admin' ? '/admin' : returnTo, { replace: true })
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Vui lòng thử lại sau.')
    } finally {
      setPending(false)
    }
  }
  function switchMode() {
    setError('')
    setNotice('')
    setPassword('')
    setConfirmation('')
  }
  return (
    <section className="auth-page container" aria-labelledby="login-title">
      <div className="auth-layout auth-redesign">
        <aside className="auth-photo">
          <SiteImage
            src="/images/nang-gom/flowers.jpg"
            alt="Một bình hoa, một góc nhà bình yên"
            width="1536"
            height="1024"
          />
          <div>
            <span>Gốm mộc & chuyện nhà</span>
            <p>
              Những điều nhỏ.
              <br /> Một niềm vui riêng.
            </p>
            <small>Nơi những món gốm tìm thấy người thương.</small>
          </div>
        </aside>
        <div className="auth-form-panel">
          <Link className="auth-back" to="/">
            ← Ghé nhà Nàng Gốm
          </Link>
          <nav className="auth-tabs" aria-label="Tài khoản">
            <Link
              to={'/login' + suffix}
              onClick={switchMode}
              aria-current={!signingUp ? 'page' : undefined}
            >
              Đăng nhập
            </Link>
            <Link
              to={'/register' + suffix}
              onClick={switchMode}
              aria-current={signingUp ? 'page' : undefined}
            >
              Đăng ký
            </Link>
          </nav>
          <h1 id="login-title">
            {signingUp ? 'Làm quen nhé,' : 'Chào bạn,'}
            <br />
            <em>{signingUp ? 'người thương gốm.' : 'mừng trở về.'}</em>
          </h1>
          <p className="auth-intro">
            {signingUp
              ? 'Tạo một tài khoản, giữ một góc nhỏ dành riêng cho bạn.'
              : 'Một chút gốm, một chút an yên. Nhà Nàng vẫn ở đây.'}
          </p>
          {auth.status === 'loading' ? (
            <p role="status">Đang kiểm tra phiên đăng nhập…</p>
          ) : (
            <form onSubmit={submit}>
              {notice && (
                <p className="auth-success" role="status">
                  {notice}
                </p>
              )}
              {signingUp && (
                <label className="auth-field">
                  Tên của bạn
                  <input
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    disabled={pending}
                    placeholder="Nàng gọi bạn là…"
                  />
                </label>
              )}
              <label className="auth-field">
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  disabled={pending}
                  placeholder="ban@email.com"
                />
              </label>
              <label className="auth-field">
                Mật khẩu
                <span className="password-field">
                  <input
                    type={show ? 'text' : 'password'}
                    name="password"
                    autoComplete={signingUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={signingUp ? 12 : undefined}
                    maxLength={256}
                    disabled={pending}
                    aria-describedby={signingUp ? 'password-hint' : undefined}
                    placeholder="Mật khẩu của bạn"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={show}
                    onClick={() => setShow(!show)}
                  >
                    <Icon name={show ? 'eye-off' : 'eye'} />
                  </button>
                </span>
              </label>
              {signingUp ? (
                <>
                  <p id="password-hint" className="auth-password-hint">
                    Từ 12 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.
                  </p>
                  <label className="auth-field">
                    Nhập lại mật khẩu
                    <input
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      required
                      maxLength={256}
                      disabled={pending}
                      placeholder="Thêm một lần để chắc nhé"
                    />
                  </label>
                </>
              ) : (
                <label className="remember-field">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={pending}
                  />
                  Giữ đăng nhập
                </label>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button className="auth-submit" type="submit" disabled={pending}>
                {pending ? 'Đang xử lý…' : signingUp ? 'Tạo tài khoản' : 'Đăng nhập'}
                <Icon name="arrow" />
              </button>
              <div className="auth-recovery-links">
                <Link to="/forgot-password">Quên mật khẩu?</Link>
                <Link to="/request-verification">Xác minh email</Link>
              </div>
              <p className="auth-access-note">
                {signingUp ? 'Đã có một góc nhỏ?' : 'Lần đầu ghé Nàng?'}{' '}
                <Link to={signingUp ? '/login' : '/register'} onClick={switchMode}>
                  {signingUp ? 'Đăng nhập' : 'Tạo tài khoản'}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
