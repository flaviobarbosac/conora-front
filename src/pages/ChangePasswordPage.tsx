import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { PasswordField } from '../components/ui/PasswordField'
import styles from './pageStyles'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      await authApi.changePassword(password, currentPassword)
      await logout()
      navigate('/login?senha=alterada', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível alterar a senha.')
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Alterar senha" backTo={{ to: '/perfil', label: '← Perfil' }} />
      <section className={styles.section}>
        <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className={styles.formWide}>
            <PasswordField
              label="Senha atual"
              name="currentPassword"
              autoComplete="current-password"
              autoFocus
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              hint="Se a conta ainda não tem senha, deixe em branco."
            />
          </div>
          <div className={styles.formWide}>
            <PasswordField
              label="Nova senha"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="Mínimo de 8 caracteres."
            />
          </div>
          <div className={styles.formWide}>
            <PasswordField
              label="Confirmar senha"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.formActions}>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? 'Salvando…' : 'Salvar senha'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
