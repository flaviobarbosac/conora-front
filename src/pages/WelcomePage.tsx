import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthLayout } from '../layouts/AuthLayout'
import { Button } from '../components/ui/Button'
import styles from './auth.module.css'

/** Shown right after Conora e-mail validation (product copy from the PDF). */
export function WelcomePage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) return
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 4000)
    return () => window.clearTimeout(timer)
  }, [session, navigate])

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <AuthLayout
      title="Bem-vindo ao Conora"
      subtitle="A organização da sua vida financeira começa aqui."
      footer={null}
    >
      <p className={styles.notice} role="status">
        Sua conta está validada. Em instantes você segue para o painel inicial, no plano gratuito.
      </p>
      <div className={styles.actions}>
        <Button type="button" onClick={() => navigate('/', { replace: true })}>
          Ir para o painel
        </Button>
      </div>
    </AuthLayout>
  )
}
