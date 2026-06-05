import type { AppProps } from 'next/app'
import { createContext, useContext, useEffect, useState } from 'react'
import '@/styles/globals.css'

type User = { id: string; name: string; email: string } | null

type AuthCtx = {
  user: User
  loading: boolean
  refresh: () => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refresh: () => {}, logout: () => {} })
export const useAuth = () => useContext(AuthContext)

export default function App({ Component, pageProps }: AppProps) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const r = await fetch('/api/auth/session')
    const d = await r.json()
    setUser(d.user ?? null)
    setLoading(false)
  }

  const logout = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' })
    setUser(null)
  }

  useEffect(() => { refresh() }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      <Component {...pageProps} />
    </AuthContext.Provider>
  )
}
