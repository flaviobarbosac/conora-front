import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  authApi,
  clearSession,
  emailFromAccessToken,
  getAccessToken,
  getRefreshToken,
  persistSession,
  restoreSession,
  type AuthResponse,
} from '../api/client'
import { isNativeApp } from '../lib/platform'

type Session = {
  email: string
}

type AuthContextValue = {
  session: Session | null
  authReady: boolean
  login: (usuario: string, password: string) => Promise<void>
  register: (name: string, email: string, cpf: string, password: string) => Promise<void>
  loginGoogle: (idToken: string) => Promise<void>
  loginApple: (identityToken: string, name?: string | null, email?: string | null) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function sessionFromAuth(auth: AuthResponse): Session {
  return { email: auth.email }
}

function needsNativeRestore(): boolean {
  return isNativeApp() && !getAccessToken() && Boolean(getRefreshToken())
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const token = getAccessToken()
    return token ? { email: emailFromAccessToken(token) } : null
  })
  const [authReady, setAuthReady] = useState(() => !needsNativeRestore())

  useEffect(() => {
    if (authReady) {
      return
    }
    let cancelled = false
    void restoreSession().then((ok) => {
      if (cancelled) {
        return
      }
      if (ok) {
        const token = getAccessToken()
        if (token) {
          setSession({ email: emailFromAccessToken(token) })
        }
      }
      setAuthReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [authReady])

  const applyAuth = useCallback((auth: AuthResponse) => {
    persistSession(auth)
    setSession(sessionFromAuth(auth))
  }, [])

  const login = useCallback(
    async (usuario: string, password: string) => {
      applyAuth(await authApi.login(usuario, password))
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Login'))
    },
    [applyAuth],
  )

  const register = useCallback(
    async (name: string, email: string, cpf: string, password: string) => {
      applyAuth(await authApi.register(name, email, cpf, password))
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Register'))
    },
    [applyAuth],
  )

  const loginGoogle = useCallback(
    async (idToken: string) => {
      applyAuth(await authApi.google(idToken))
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Login'))
    },
    [applyAuth],
  )

  const loginApple = useCallback(
    async (identityToken: string, name?: string | null, email?: string | null) => {
      applyAuth(await authApi.apple(identityToken, name, email))
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Login'))
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
    () => ({ session, authReady, login, register, loginGoogle, loginApple, logout }),
    [session, authReady, login, register, loginGoogle, loginApple, logout],
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
