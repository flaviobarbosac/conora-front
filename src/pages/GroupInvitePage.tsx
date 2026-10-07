import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { familyApi, type FamilyInvitePreview } from '../api/finance'
import { emailFromAccessToken, getAccessToken } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { AuthLayout } from '../layouts/AuthLayout'
import { useAction } from '../hooks/useAction'
import { errorMessage } from '../lib/format'
import styles from './page.module.css'

export function GroupInvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [preview, setPreview] = useState<FamilyInvitePreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepted, setAccepted] = useState(false)
  const accept = useAction()

  const returnTo = encodeURIComponent(`/grupo/convite/${token}`)
  const loginHref = `/login?returnTo=${returnTo}`
  const registerHref = `/register?returnTo=${returnTo}`

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void familyApi
      .previewInvite(token)
      .then((data) => {
        if (!cancelled) {
          setPreview(data)
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(errorMessage(caught))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const sessionEmail = session?.email ?? emailFromAccessToken(getAccessToken())
  const emailMismatch =
    preview?.email &&
    sessionEmail &&
    preview.email.trim().toLowerCase() !== sessionEmail.trim().toLowerCase()

  async function onAccept() {
    if (await accept.run(() => familyApi.acceptInvite(token))) {
      setAccepted(true)
    }
  }

  if (loading) {
    return (
      <AuthLayout title="Convite para o grupo" subtitle="Carregando…">
        <Loading />
      </AuthLayout>
    )
  }

  if (loadError || !preview) {
    return (
      <AuthLayout title="Convite para o grupo" subtitle="Não foi possível carregar o convite.">
        <ErrorText message={loadError} />
        <p className={styles.muted}>
          <Link to="/">Voltar ao início</Link>
        </p>
      </AuthLayout>
    )
  }

  if (accepted) {
    return (
      <AuthLayout title="Bem-vindo ao grupo" subtitle={`Você entrou no grupo de ${preview.inviterName || 'sua família'}.`}>
        <section className={styles.section}>
          <p>
            A partir de agora você pode usar o <strong>orçamento da família</strong> (visão compartilhada) e continuar com suas{' '}
            <strong>contas pessoais</strong> quando fizer sentido.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => navigate('/orcamento')}>Ver orçamento</Button>
            <Button variant="secondary" onClick={() => navigate('/membros')}>
              Grupo e perfil
            </Button>
          </div>
        </section>
      </AuthLayout>
    )
  }

  const statusMessage: Record<string, string> = {
    Invalid: 'Este link de convite não é válido.',
    Cancelled: 'Este convite foi cancelado.',
    Accepted: 'Este convite já foi aceito. Se você já faz parte do grupo, pode ir ao orçamento.',
    Expired: 'Este convite expirou.',
    Open: '',
  }

  const blocked = preview.status !== 'Open'

  return (
    <AuthLayout
      title="Convite para o grupo"
      subtitle={
        preview.status === 'Open'
          ? `${preview.inviterName} convidou ${preview.email} para o grupo familiar no Conora.`
          : statusMessage[preview.status] ?? 'Convite indisponível.'
      }
    >
      {blocked ? (
        <div className={styles.actions}>
          {preview.status === 'Accepted' && session ? (
            <Button onClick={() => navigate('/orcamento')}>Ir ao orçamento</Button>
          ) : (
            <Button variant="secondary" onClick={() => navigate('/')}>
              Início
            </Button>
          )}
        </div>
      ) : !session ? (
        <>
          <p className={styles.muted}>
            Entre ou crie uma conta com o e-mail <strong>{preview.email}</strong> para aceitar o convite.
          </p>
          <div className={styles.actions}>
            <Link to={loginHref}>
              <Button>Entrar</Button>
            </Link>
            <Link to={registerHref}>
              <Button variant="secondary">Criar conta</Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          {emailMismatch ? (
            <p className={styles.muted}>
              Você está logado como <strong>{sessionEmail}</strong>, mas o convite é para <strong>{preview.email}</strong>.
              Use a conta correta para aceitar.
            </p>
          ) : null}
          <ErrorText message={accept.error} />
          <div className={styles.actions}>
            <Button disabled={accept.busy || Boolean(emailMismatch)} onClick={() => void onAccept()}>
              Aceitar convite
            </Button>
          </div>
        </>
      )}
    </AuthLayout>
  )
}
