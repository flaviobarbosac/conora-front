import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { formatCpfInput } from '../auth/loginIdentifier'
import { useAuth } from '../auth/AuthProvider'
import { appleSignInAvailable, requestAppleIdentityToken } from '../auth/apple'
import { requestGoogleIdToken } from '../auth/google'
import { AppleMark } from '../components/AppleMark'
import { GoogleMark } from '../components/GoogleMark'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { PasswordField } from '../components/ui/PasswordField'
import { AuthLayout } from '../layouts/AuthLayout'
import { confirmInfo } from '../lib/confirm'
import styles from './auth.module.css'

function safeReturnTo(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return '/'
}

function isAlreadyRegisteredMessage(message: string): boolean {
  return /já existe|já tem uma conta|email duplicado|já cadastrado|conta conora com este|conta existente/i.test(
    message,
  )
}

function isPreRegistrationEmailSent(message: string): boolean {
  return /enviamos um e-mail de validação/i.test(message)
}

export function RegisterPage() {
  const { session, register, registerGoogle, registerApple } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const afterRegister = safeReturnTo(searchParams.get('returnTo'))
  const invitedEmail = (searchParams.get('email') ?? '').trim()
  const emailLocked = invitedEmail.includes('@')
  const missingAccount = searchParams.get('aviso') === 'conta-inexistente'
  const loginTo = afterRegister === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(afterRegister)}`
  const showApple = appleSignInAvailable()
  const [name, setName] = useState('')
  const [email, setEmail] = useState(invitedEmail)
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    return <Navigate to={afterRegister} replace />
  }

  async function goLoginBecauseExists(message: string, usuario?: string) {
    const base =
      loginTo.includes('?')
        ? `${loginTo}&aviso=conta-existe`
        : `${loginTo}?aviso=conta-existe`
    const withUser = usuario?.trim()
      ? `${base}&usuario=${encodeURIComponent(usuario.trim())}`
      : base
    await confirmInfo(message, { title: 'Conta existente' })
    navigate(withUser, { replace: true })
  }

  async function handleRegisterError(message: string, usuario?: string) {
    if (isPreRegistrationEmailSent(message)) {
      await confirmInfo(message, { title: 'Verifique seu e-mail' })
      return
    }
    if (isAlreadyRegisteredMessage(message)) {
      await goLoginBecauseExists(message, usuario)
      return
    }
    setError(message)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }

    setBusy(true)
    try {
      await register(name, email, cpf, password)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível criar o acesso.'
      await handleRegisterError(message, email)
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setBusy(true)
    setError(null)
    try {
      await registerGoogle(await requestGoogleIdToken())
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível criar com Google.'
      await handleRegisterError(message)
    } finally {
      setBusy(false)
    }
  }

  async function onApple() {
    setBusy(true)
    setError(null)
    try {
      const apple = await requestAppleIdentityToken()
      await registerApple(apple.identityToken, apple.name, apple.email)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível criar com Apple.'
      await handleRegisterError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle={
        emailLocked
          ? `Convite para ${invitedEmail}. Complete o cadastro com este e-mail.`
          : 'Crie um acesso novo com e-mail e senha, Google ou Apple. Cada provedor gera uma conta Conora separada.'
      }
      footer={
        <>
          Já tem conta? <Link to={loginTo}>Entrar</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        {missingAccount ? (
          <p className={styles.notice} role="status">
            Não encontramos esse acesso. Crie a conta aqui e depois entre.
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button type="button" variant="secondary" className={styles.google} disabled={busy} onClick={() => void onGoogle()}>
            <GoogleMark />
            Criar com Google
          </Button>
          {showApple ? (
            <Button type="button" variant="secondary" className={styles.google} disabled={busy} onClick={() => void onApple()}>
              <AppleMark />
              Criar com Apple
            </Button>
          ) : null}
          <div className={styles.divider} aria-hidden="true">
            <span>ou com e-mail</span>
          </div>
        </div>
        <Field label="Nome" name="name" required value={name} onChange={(event) => setName(event.target.value)} />
        <Field
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly={emailLocked}
          disabled={emailLocked}
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
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Mínimo de 8 caracteres."
        />
        <PasswordField
          label="Confirmar senha"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          hint="Digite a mesma senha de novo."
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
