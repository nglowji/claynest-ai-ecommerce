import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from './Icon'

export default function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  if (auth.status === 'authenticated') return <Navigate to="/account" replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError(''); setPending(true)
    try {
      await auth.login(email.trim(), password, remember)
      setPassword('')
      navigate('/account', { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa thể đăng nhập. Vui lòng thử lại.')
    } finally { setPending(false) }
  }
  return <section className="auth-page container" aria-labelledby="login-title">
    <div className="auth-layout"><div className="auth-photo"><img src="/images/nang-gom/flowers.jpg" alt="Bình gốm và nhành hoa bên góc nhà yên tĩnh" width="1536" height="1024" /><div><span>Nàng Gốm</span><p>Một chút chăm chút.<br />Một nhà đầy thương.</p></div></div>
    <div className="auth-form-panel"><Link className="auth-back" to="/">← Về nhà Nàng</Link><p className="eyebrow">KHÔNG GIAN QUẢN TRỊ</p><h1 id="login-title">Chào bạn,<br /><em>mừng trở về.</em></h1><p className="auth-intro">Đăng nhập để tiếp tục chăm chút cho Nàng Gốm.</p>
      {auth.status === 'loading' ? <p className="auth-session-check" role="status">Đang kiểm tra phiên đăng nhập…</p> : <form onSubmit={submit}>
        {auth.status === 'unavailable' && !error && <p className="auth-connection-note">Dịch vụ đăng nhập chưa kết nối được. Bạn có thể thử lại bên dưới.</p>}
        <label className="auth-field">Email quản trị<input type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="Email của bạn" disabled={pending} aria-describedby={error ? 'login-error' : undefined} /></label>
        <label className="auth-field">Mật khẩu<span className="password-field"><input type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={256} placeholder="Nhập mật khẩu" disabled={pending} aria-describedby={error ? 'login-error' : undefined} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name={showPassword ? 'eye-off' : 'eye'} /></button></span></label>
        <label className="remember-field"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} disabled={pending} />Giữ đăng nhập trên thiết bị này</label>
        {error && <p id="login-error" className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={pending}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}{!pending && <Icon name="arrow" />}</button>
        <p className="auth-access-note">Dành cho tài khoản quản trị được cấp. Bạn vẫn có thể khám phá cửa hàng mà không cần đăng nhập.</p>
      </form>}
    </div></div>
  </section>
}
