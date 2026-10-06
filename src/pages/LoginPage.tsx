import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { requestGoogleIdToken } from '../auth/google'
import { formatLoginUsuario } from '../auth/loginIdentifier'
import { GoogleMark } from '../components/GoogleMark'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { AuthLayout } from '../layouts/AuthLayout'
import styles from './auth.module.css'

export function LoginPage() {
  const { session, login, loginGoogle } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to="/" replace />
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
      subtitle="Use CPF ou e-mail, ou continue com Google."
      footer={
        <>
          Ainda não tem acesso? <Link to="/register">Saiba como liberar</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <Field
          label="CPF ou e-mail"
          name="usuario"
          type="text"
          inputMode="email"
          autoComplete="username"
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
            <a
              href="#esqueci"
              onClick={(event) => {
                event.preventDefault()
                setError('Recuperação de senha entra na próxima etapa.')
              }}
            >
              Esqueci a senha
            </a>
          }
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy}>
            Entrar
          </Button>
          <Button variant="secondary" className={styles.google} disabled={busy} onClick={() => void onGoogle()}>
            <GoogleMark />
            Continuar com Google
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
