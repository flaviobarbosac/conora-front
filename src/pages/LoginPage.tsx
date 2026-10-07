import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { appleSignInAvailable, requestAppleIdentityToken } from '../auth/apple'
import { requestGoogleIdToken } from '../auth/google'
import { formatLoginUsuario } from '../auth/loginIdentifier'
import { GoogleMark } from '../components/GoogleMark'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { AuthLayout } from '../layouts/AuthLayout'
import styles from './auth.module.css'

function safeReturnTo(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return '/'
}

export function LoginPage() {
  const { session, login, loginGoogle, loginApple } = useAuth()
  const [searchParams] = useSearchParams()
  const afterLogin = safeReturnTo(searchParams.get('returnTo'))
  const registerTo = afterLogin === '/' ? '/register' : `/register?returnTo=${encodeURIComponent(afterLogin)}`
  const showApple = appleSignInAvailable()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to={afterLogin} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(usuario, password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setBusy(true)
    setError(null)
    try {
      await loginGoogle(await requestGoogleIdToken())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar com Google.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse com CPF ou e-mail. Google é opcional."
      footer={
        <>
          Ainda não tem conta? <Link to={registerTo}>Criar conta</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field
          label="CPF ou e-mail"
          name="usuario"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoFocus
          required
          value={usuario}
          onChange={(event) => setUsuario(formatLoginUsuario(event.target.value))}
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setError('Recuperação de senha entra na próxima etapa.')}
            >
              Esqueci a senha
            </button>
          }
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          <div className={styles.divider} aria-hidden="true">
            <span>ou</span>
          </div>
          <Button variant="secondary" className={styles.google} disabled={busy} onClick={() => void onGoogle()}>
            <GoogleMark />
            Continuar com Google
          </Button>
          {showApple ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await loginApple(await requestAppleIdentityToken())
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : 'Não foi possível entrar com Apple.')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Continuar com Apple
            </Button>
          ) : null}
        </div>
      </form>
    </AuthLayout>
  )
}
