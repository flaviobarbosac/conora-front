import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { formatCpfInput } from '../auth/loginIdentifier'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { AuthLayout } from '../layouts/AuthLayout'
import styles from './auth.module.css'

export function RegisterPage() {
  const { session, register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
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
      await register(name, email, cpf, password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar o acesso.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Liberar acesso"
      subtitle="Crie a conta da família com CPF, e-mail e senha — ou entre depois com Google."
      footer={
        <>
          Já tem acesso? <Link to="/login">Entrar</Link>
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
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy}>
            Criar acesso
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
