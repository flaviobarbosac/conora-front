import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { formatCpfInput } from '../auth/loginIdentifier'
import { useAuth } from '../auth/AuthProvider'
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

export function RegisterPage() {
  const { session, register } = useAuth()
  const [searchParams] = useSearchParams()
  const afterRegister = safeReturnTo(searchParams.get('returnTo'))
  const loginTo = afterRegister === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(afterRegister)}`
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to={afterRegister} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register(name, email, cpf, password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar o acesso.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Cadastre a família com nome, CPF, e-mail e senha. Depois você já entra no painel."
      footer={
        <>
          Já tem conta? <Link to={loginTo}>Entrar</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <Field label="Nome" name="name" required value={name} onChange={(event) => setName(event.target.value)} />
        <Field
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="CPF"
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          required
          value={cpf}
          onChange={(event) => setCpf(formatCpfInput(event.target.value))}
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Criando…' : 'Criar conta'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
