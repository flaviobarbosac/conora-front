import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, getAccessToken, type AuthResponse } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppHandoff, consumeAppLinkRoute, useAppHandoff } from '../lib/appLinks'
import styles from './auth.module.css'

/** One in-flight/completed verify per token (Strict Mode + double deep-link). */
const verifyByToken = new Map<string, Promise<AuthResponse>>()

function verifyEmailOnce(token: string): Promise<AuthResponse> {
  const existing = verifyByToken.get(token)
  if (existing) return existing
  const pending = authApi.verifyEmail(token).catch((error: unknown) => {
    // Drop failed attempts so a later open (browser then app) can retry the same token.
    verifyByToken.delete(token)
    throw error
  })
  verifyByToken.set(token, pending)
  return pending
}

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const { acceptSession } = useAuth()
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const { handoff, redirectingToApp, url, continueInBrowser } = useAppHandoff('validar-email')

  function goLogin(event?: { preventDefault: () => void }) {
    event?.preventDefault()
    if (token) {
      consumeAppLinkRoute(`/validar-email?token=${encodeURIComponent(token)}`)
    }
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    // Don't call API while redirecting to app or showing handoff UI
    if (handoff || redirectingToApp) return
    let cancelled = false

    async function run() {
      if (!token) {
        setError('Link inválido. Peça outro ao tentar entrar.')
        setBusy(false)
        return
      }

      consumeAppLinkRoute(`/validar-email?token=${encodeURIComponent(token)}`)

      try {
        const auth = await verifyEmailOnce(token)
        if (cancelled) return
        acceptSession(auth)
        navigate('/bem-vindo', { replace: true })
      } catch (caught) {
        if (cancelled) return
        // First open may have already logged the person in (double deep-link / Strict Mode).
        if (getAccessToken()) {
          navigate('/bem-vindo', { replace: true })
          return
        }
        setError(caught instanceof Error ? caught.message : 'Não foi possível validar o e-mail.')
        setBusy(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [token, handoff, redirectingToApp, acceptSession, navigate])

  // Mobile web: redirecting to app, show loading state
  if (redirectingToApp) {
    return (
      <AuthLayout title="Abrindo o app Conora" subtitle="Aguarde um momento...">
        <p className={styles.notice} role="status">
          Redirecionando para o aplicativo.
        </p>
      </AuthLayout>
    )
  }

  // Mobile web: redirect failed (app not installed), show fallback options
  if (handoff) return <AppHandoff url={url} onContinue={continueInBrowser} />

  return (
    <AuthLayout
      title="Validar e-mail"
      subtitle={busy ? 'Confirmando seu endereço…' : 'Não foi possível concluir a validação.'}
      footer={
        <>
          <Link to="/login" replace onClick={goLogin}>
            Voltar ao login
          </Link>
        </>
      }
    >
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.notice} role="status">
          Aguarde um instante.
        </p>
      )}
    </AuthLayout>
  )
}
