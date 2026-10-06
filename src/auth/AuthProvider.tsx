import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  authApi,
  clearSession,
  emailFromAccessToken,
  getAccessToken,
  persistSession,
  type AuthResponse,
} from '../api/client'

type Session = {
  email: string
}

type AuthContextValue = {
  session: Session | null
  login: (usuario: string, password: string) => Promise<void>
  register: (name: string, email: string, cpf: string, password: string) => Promise<void>
  loginGoogle: (idToken: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function sessionFromAuth(auth: AuthResponse): Session {
  return { email: auth.email }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const token = getAccessToken()
    return token ? { email: emailFromAccessToken(token) } : null
  })

  const applyAuth = useCallback((auth: AuthResponse) => {
    persistSession(auth)
    setSession(sessionFromAuth(auth))
  }, [])

  const login = useCallback(
    async (usuario: string, password: string) => {
      applyAuth(await authApi.login(usuario, password))
    },
    [applyAuth],
  )

  const register = useCallback(
    async (name: string, email: string, cpf: string, password: string) => {
      applyAuth(await authApi.register(name, email, cpf, password))
    },
    [applyAuth],
  )

  const loginGoogle = useCallback(
    async (idToken: string) => {
      applyAuth(await authApi.google(idToken))
    },
    [applyAuth],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // local session is cleared anyway
    }
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, login, register, loginGoogle, logout }),
    [session, login, register, loginGoogle, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
