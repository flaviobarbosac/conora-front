import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { appleSignInAvailable, requestAppleIdentityToken } from '../auth/apple'
import { requestGoogleIdToken } from '../auth/google'
import { formatLoginUsuario } from '../auth/loginIdentifier'
import { AppleMark } from '../components/AppleMark'
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

function isMissingAccountMessage(message: string): boolean {
  return /não encontramos uma conta|conta não encontrada|crie uma conta/i.test(message)
}

export function LoginPage() {
  const { session, authReady, login, loginGoogle, loginApple } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const afterLogin = safeReturnTo(searchParams.get('returnTo'))
  const fromInvite = afterLogin.startsWith('/grupo/convite/')
  const emailSent = searchParams.get('aviso') === 'email-enviado'
  const accountExists = searchParams.get('aviso') === 'conta-existe'
  const registerTo = afterLogin === '/' ? '/register' : `/register?returnTo=${encodeURIComponent(afterLogin)}`
  const showApple = appleSignInAvailable()
  const [usuario, setUsuario] = useState(() => searchParams.get('usuario') ?? '')
  const [password, setPassword] = useState('')
  const forgotTo = usuario.trim()
    ? `/recuperar-senha?usuario=${encodeURIComponent(usuario.trim())}`
    : '/recuperar-senha'
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!authReady) {
    return null
  }

  if (session) {
    return <Navigate to={afterLogin} replace />
  }

  function goRegisterBecauseMissing(message: string) {
    const dest =
      registerTo.includes('?')
        ? `${registerTo}&aviso=conta-inexistente`
        : `${registerTo}?aviso=conta-inexistente`
    setError(message)
    window.setTimeout(() => navigate(dest, { replace: true }), 1200)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(usuario, password)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível entrar.'
      if (isMissingAccountMessage(message)) {
        goRegisterBecauseMissing(message)
      } else {
        setError(message)
      }
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
      const message = caught instanceof Error ? caught.message : 'Não foi possível entrar com Google.'
      if (isMissingAccountMessage(message)) {
        goRegisterBecauseMissing(message)
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function onApple() {
    setBusy(true)
    setError(null)
    try {
      const apple = await requestAppleIdentityToken()
      await loginApple(apple.identityToken, apple.name, apple.email)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível entrar com Apple.'
      if (isMissingAccountMessage(message)) {
        goRegisterBecauseMissing(message)
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  const socialLogin = (
    <>
      <Button variant="secondary" className={styles.google} disabled={busy} onClick={() => void onGoogle()}>
        <GoogleMark />
        Entrar com Google
      </Button>
      {showApple ? (
        <Button variant="secondary" className={styles.google} disabled={busy} onClick={() => void onApple()}>
          <AppleMark />
          Entrar com Apple
        </Button>
      ) : null}
    </>
  )

  return (
    <AuthLayout
      title="Entrar"
      subtitle={
        fromInvite
          ? 'Para aceitar o convite, entre com uma conta Conora já criada (Google, Apple, CPF ou e-mail).'
          : 'Entre só se a conta já existir. Google e Apple abrem a conta daquele provedor — não criam acesso novo aqui.'
      }
      footer={
        <>
          Ainda não tem conta? <Link to={registerTo}>Criar conta</Link>
          <br />
          <Link to="/apresentacao">Conhecer o produto</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
        {emailSent ? (
          <p className={styles.notice} role="status">
            E-mail enviado. Abra o link para definir a senha e entre com ela aqui.
          </p>
        ) : null}
        {accountExists ? (
          <p className={styles.notice} role="status">
            Esta conta já existe. Entre com o mesmo acesso usado no cadastro.
          </p>
        ) : null}
        {fromInvite ? (
          <div className={styles.actions}>
            {socialLogin}
            <div className={styles.divider} aria-hidden="true">
              <span>ou</span>
            </div>
          </div>
        ) : null}
        <Field
          label="CPF ou e-mail"
          name="usuario"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoFocus={!fromInvite}
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
            <Link className={styles.linkBtn} to={forgotTo}>
              Esqueci a senha
            </Link>
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
          {fromInvite ? null : (
            <>
              <div className={styles.divider} aria-hidden="true">
                <span>ou</span>
              </div>
              {socialLogin}
            </>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
