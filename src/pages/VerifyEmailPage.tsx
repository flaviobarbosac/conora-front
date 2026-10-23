import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi, persistSession } from '../api/client'
import { AuthLayout } from '../layouts/AuthLayout'
import styles from './auth.module.css'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!token) {
        setError('Link inválido. Peça outro ao tentar entrar.')
        setBusy(false)
        return
      }
      try {
        const auth = await authApi.verifyEmail(token)
        if (cancelled) return
        persistSession(auth)
        // Full navigation so AuthProvider reloads the session from storage.
        window.location.replace(`${import.meta.env.BASE_URL}bem-vindo`.replace(/\/{2,}/g, '/'))
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível validar o e-mail.')
          setBusy(false)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <AuthLayout
      title="Validar e-mail"
      subtitle={busy ? 'Confirmando seu endereço…' : 'Não foi possível concluir a validação.'}
      footer={
        <>
          <Link to="/login">Voltar ao login</Link>
        </>
      }
    >
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.notice} role="status">
          Aguarde um instante.
        </p>
      )}
    </AuthLayout>
  )
}
