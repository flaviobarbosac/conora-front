import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { guestAuthPath } from '../lib/deviceIdentity'
import { AuthLayout } from '../layouts/AuthLayout'
import { Button } from '../components/ui/Button'
import styles from './auth.module.css'

/** Shown right after Conora e-mail validation; then first onboard step (Seus dados). */
export function WelcomePage() {
  const { session, authReady } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authReady || !session) return
    const timer = window.setTimeout(() => navigate('/onboarding', { replace: true }), 4000)
    return () => window.clearTimeout(timer)
  }, [authReady, session, navigate])

  if (!authReady) {
    return null
  }
  if (!session) {
    return <Navigate to={guestAuthPath()} replace />
  }

  return (
    <AuthLayout
      title="Bem-vindo ao Conora"
      subtitle="A organização da sua vida financeira começa aqui."
      footer={null}
    >
      <p className={styles.notice} role="status">
        Sua conta está validada. Em instantes você começa o cadastro inicial.
      </p>
      <div className={styles.actions}>
        <Button type="button" onClick={() => navigate('/onboarding', { replace: true })}>
          Continuar
        </Button>
      </div>
    </AuthLayout>
  )
}
