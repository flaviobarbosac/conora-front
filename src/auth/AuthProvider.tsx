import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  authApi,
  clearSession,
  emailFromAccessToken,
  getAccessToken,
  getRefreshToken,
  persistSession,
  restoreSession,
  SESSION_EXPIRED_EVENT,
  type AuthResponse,
} from '../api/client'
import { logCompleteRegistration } from '../lib/metaEvents'
type Session = {
  email: string
}

type AuthContextValue = {
  session: Session | null
  authReady: boolean
  /** Persist tokens and set session without a full page reload (e-mail validation handoff). */
  acceptSession: (auth: AuthResponse) => void
  login: (usuario: string, password: string) => Promise<void>
  register: (name: string, email: string, cpf: string, password: string) => Promise<void>
  loginGoogle: (idToken: string) => Promise<void>
  registerGoogle: (idToken: string) => Promise<void>
  loginApple: (identityToken: string, name?: string | null, email?: string | null) => Promise<void>
  registerApple: (identityToken: string, name?: string | null, email?: string | null) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function sessionFromAuth(auth: AuthResponse): Session {
  return { email: auth.email }
}

/** Web and native: rebuild access from refresh before the splash ends. */
function needsSessionRestore(): boolean {
  return !getAccessToken() && Boolean(getRefreshToken())
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const token = getAccessToken()
    return token ? { email: emailFromAccessToken(token) } : null
  })
  const [authReady, setAuthReady] = useState(() => !needsSessionRestore())

  useEffect(() => {
    const onExpired = () => setSession(null)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

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

  useEffect(() => {
    if (!authReady || !session) {
      return
    }
    void import('../lib/pushNotifications').then(({ ensurePushRegistration }) => {
      void ensurePushRegistration()
    })
  }, [authReady, session])

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
      const auth = await authApi.register(name, email, cpf, password)
      applyAuth(auth)
      logCompleteRegistration(auth.userId, 'email')
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Register'))
    },
    [applyAuth],
  )

  const loginGoogle = useCallback(
    async (idToken: string) => {
      applyAuth(await authApi.google(idToken, 'login'))
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Login'))
    },
    [applyAuth],
  )

  const registerGoogle = useCallback(
    async (idToken: string) => {
      const auth = await authApi.google(idToken, 'register')
      applyAuth(auth)
      logCompleteRegistration(auth.userId, 'google')
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Register'))
    },
    [applyAuth],
  )

  const loginApple = useCallback(
    async (identityToken: string, name?: string | null, email?: string | null) => {
      applyAuth(await authApi.apple(identityToken, name, email, 'login'))
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Login'))
    },
    [applyAuth],
  )

  const registerApple = useCallback(
    async (identityToken: string, name?: string | null, email?: string | null) => {
      const auth = await authApi.apple(identityToken, name, email, 'register')
      applyAuth(auth)
      logCompleteRegistration(auth.userId, 'apple')
      void import('../lib/journeyTrack').then(({ trackJourney }) => trackJourney('/', 'Register'))
    },
    [applyAuth],
  )

  const logout = useCallback(async () => {
    try {
      const { clearPushRegistration } = await import('../lib/pushNotifications')
      await clearPushRegistration()
    } catch {
      // push cleanup must not block logout
    }
    try {
      await authApi.logout()
    } catch {
      // local session is cleared anyway
    }
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authReady,
      acceptSession: applyAuth,
      login,
      register,
      loginGoogle,
      registerGoogle,
      loginApple,
      registerApple,
      logout,
    }),
    [
      session,
      authReady,
      applyAuth,
      login,
      register,
      loginGoogle,
      registerGoogle,
      loginApple,
      registerApple,
      logout,
    ],
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
