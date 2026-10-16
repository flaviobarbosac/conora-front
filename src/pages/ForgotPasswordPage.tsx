import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import { formatLoginUsuario } from '../auth/loginIdentifier'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { AuthLayout } from '../layouts/AuthLayout'
import styles from './auth.module.css'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [usuario, setUsuario] = useState(() => searchParams.get('usuario') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await authApi.forgotPassword(usuario)
      const params = new URLSearchParams({ aviso: 'email-enviado' })
      if (usuario.trim()) {
        params.set('usuario', usuario.trim())
      }
      navigate(`/login?${params.toString()}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar o link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe o CPF ou o e-mail da conta. Vale para quem entrou com Google ou Apple: o link define uma senha e você passa a entrar com e-mail também."
      footer={
        <>
          Lembrou a senha? <Link to="/login">Entrar</Link>
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
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Enviando…' : 'Enviar link'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
