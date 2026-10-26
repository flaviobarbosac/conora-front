import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppHandoff, useAppHandoff } from '../lib/appLinks'
import styles from './auth.module.css'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const { handoff, url, continueInBrowser } = useAppHandoff('redefinir-senha')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não conferem.')
      return
    }

    setBusy(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível definir a senha.')
    } finally {
      setBusy(false)
    }
  }

  if (handoff) return <AppHandoff url={url} onContinue={continueInBrowser} />

  return (
    <AuthLayout
      title="Definir senha"
      subtitle="Escolha uma senha para entrar com CPF ou e-mail. Conta Google ou Apple continua funcionando."
      footer={
        <>
          <Link to="/login">Voltar ao login</Link>
        </>
      }
    >
      {!token ? (
        <p className={styles.error} role="alert">
          Link inválido. Peça outro em <Link to="/recuperar-senha">Esqueci a senha</Link>.
        </p>
      ) : done ? (
        <p className={styles.notice} role="status">
          Senha definida. Entre com CPF ou e-mail e a senha nova.
        </p>
      ) : (
        <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
          <Field
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Field
            label="Confirmar senha"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? 'Salvando…' : 'Salvar senha'}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
