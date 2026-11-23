import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { currentUser, signIn, signOut, type AdminUser } from './api'

type Status = 'loading' | 'authenticated' | 'anonymous' | 'unavailable'
type Auth = {
  user: AdminUser | null
  status: Status
  login: (email: string, password: string, rememberMe: boolean) => Promise<AdminUser>
  logout: () => Promise<void>
  expire: () => void
  refresh: () => Promise<void>
}
const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  function expire() {
    setUser(null)
    setStatus('anonymous')
  }
  async function refresh() {
    try {
      const value = await currentUser()
      setUser(value)
      setStatus(value ? 'authenticated' : 'anonymous')
    } catch {
      setStatus('unavailable')
    }
  }
  useEffect(() => {
    let active = true
    currentUser()
      .then((value) => {
        if (active) {
          setUser(value)
          setStatus(value ? 'authenticated' : 'anonymous')
        }
      })
      .catch(() => {
        if (active) setStatus('unavailable')
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!user) return
    // Revalidate when returning to the tab and periodically while it stays open.
    // A temporary network failure preserves the user for a retry; 401 clears it.
    let active = true
    const check = () =>
      currentUser()
        .then((value) => {
          if (active) {
            setUser(value)
            setStatus(value ? 'authenticated' : 'anonymous')
          }
        })
        .catch(() => {
          /* Protected screens also handle service failures explicitly. */
        })
    const focus = () => {
      void check()
    }
    const interval = window.setInterval(focus, 60000)
    window.addEventListener('focus', focus)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', focus)
    }
  }, [user?.id])
  async function login(email: string, password: string, rememberMe: boolean) {
    const value = await signIn(email, password, rememberMe)
    setUser(value)
    setStatus('authenticated')
    return value
  }
  async function logout() {
    await signOut()
    setUser(null)
    setStatus('anonymous')
  }
  return (
    <AuthContext.Provider value={{ user, status, login, logout, expire, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is required')
  return context
}
