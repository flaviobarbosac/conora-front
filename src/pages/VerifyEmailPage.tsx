import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppHandoff, useAppHandoff } from '../lib/appLinks'
import styles from './auth.module.css'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const { acceptSession } = useAuth()
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const { handoff, url, continueInBrowser } = useAppHandoff('validar-email')
  const started = useRef(false)

  useEffect(() => {
    // The token is single-use: keep it for the app until the user picks the browser.
    if (handoff) return
    if (started.current) return
    started.current = true
    let cancelled = false
    async function run() {
      if (!token) {
        setError('Link inválido. Peça outro ao tentar entrar.')
        setBusy(false)
        return
      }
      try {
        const auth = await authApi.verifyEmail(token)
        if (cancelled) return
        // SPA navigation keeps the session in memory — critical on iOS TestFlight where a full
        // reload can race authReady and drop the user on /login instead of bem-vindo.
        acceptSession(auth)
        navigate('/bem-vindo', { replace: true })
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível validar o e-mail.')
          setBusy(false)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token, handoff, acceptSession, navigate])

  if (handoff) return <AppHandoff url={url} onContinue={continueInBrowser} />

  return (
    <AuthLayout
      title="Validar e-mail"
      subtitle={busy ? 'Confirmando seu endereço…' : 'Não foi possível concluir a validação.'}
      footer={
        <>
          <Link to="/login">Voltar ao login</Link>
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
