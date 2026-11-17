import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { currentUser, signIn, signOut, type AdminUser } from './api'

type Status = 'loading' | 'authenticated' | 'anonymous' | 'unavailable'
type Auth = {
  user: AdminUser | null
  status: Status
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  useEffect(() => {
    let active = true
    currentUser().then(value => { if (active) { setUser(value); setStatus(value ? 'authenticated' : 'anonymous') } }).catch(() => { if (active) setStatus('unavailable') })
    return () => { active = false }
  }, [])
  async function login(email: string, password: string, rememberMe: boolean) {
    const value = await signIn(email, password, rememberMe)
    setUser(value); setStatus('authenticated')
  }
  async function logout() {
    await signOut()
    setUser(null); setStatus('anonymous')
  }
  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is required')
  return context
}
