import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import { accountRequest, updateProfile } from '../auth/accountApi'

export default function AccountSettings() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(auth.user?.displayName || '')
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  async function perform(key: string, task: () => Promise<void>) {
    if (busy) return
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await task()
    } catch (failure) {
      if (failure instanceof AuthError && failure.status === 401) auth.expire()
      setError(failure instanceof Error ? failure.message : 'Chưa lưu được thông tin.')
    } finally {
      setBusy('')
    }
  }
  function saveName(event: FormEvent) {
    event.preventDefault()
    void perform('profile', async () => {
      await updateProfile(name.trim())
      await auth.refresh()
      setNotice('Đã cập nhật họ tên.')
    })
  }
  function changePassword(event: FormEvent) {
    event.preventDefault()
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }
    void perform('password', async () => {
      await accountRequest('change-password', { currentPassword: current, newPassword: password })
      try {
        sessionStorage.setItem(
          'nang-gom-account-notice',
          'Đã đổi mật khẩu và đăng xuất các phiên cũ. Vui lòng đăng nhập lại.',
        )
      } catch {
        /* Navigation state remains available when storage is disabled. */
      }
      setCurrent('')
      setPassword('')
      setConfirmation('')
      auth.expire()
      navigate('/login', {
        replace: true,
        state: { notice: 'Đã đổi mật khẩu và đăng xuất các phiên cũ. Vui lòng đăng nhập lại.' },
      })
    })
  }
  return (
    <div className="account-settings">
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
      <form onSubmit={saveName}>
        <h3>Chỉnh sửa hồ sơ</h3>
        <label>
          Họ và tên
          <input
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!!busy}
          />
        </label>
        <button className="button primary" disabled={!!busy}>
          {busy === 'profile' ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
      </form>
      <section className="account-email-status" aria-label="Xác minh email">
        <h3>Địa chỉ email</h3>
        <p>{auth.user?.email}</p>
        <p>{auth.user?.emailConfirmed ? 'Đã xác minh email.' : 'Email chưa được xác minh.'}</p>
        {!auth.user?.emailConfirmed && (
          <button
            className="button secondary"
            disabled={!!busy}
            onClick={() =>
              void perform('verify', async () => {
                const result = await accountRequest<{ message: string }>('request-verification', {
                  email: auth.user!.email,
                })
                setNotice(result.message)
              })
            }
          >
            {busy === 'verify' ? 'Đang gửi…' : 'Gửi email xác minh'}
          </button>
        )}
      </section>
      <form onSubmit={changePassword}>
        <h3>Đổi mật khẩu</h3>
        <p className="account-help">
          Từ 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt. Sau khi đổi, bạn cần đăng nhập
          lại trên các thiết bị.
        </p>
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={!!busy}
          />
        </label>
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
            disabled={!!busy}
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
            disabled={!!busy}
          />
        </label>
        <button className="button primary" disabled={!!busy}>
          {busy === 'password' ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  )
}

export function AdminAccountPage() {
  return (
    <section className="admin-account-page">
      <p className="eyebrow">TÀI KHOẢN QUẢN TRỊ</p>
      <h1>Hồ sơ & bảo mật</h1>
      <AccountSettings />
    </section>
  )
}
