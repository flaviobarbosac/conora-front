import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { familyApi, feedbackApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { FEEDBACK_RATING_LABELS, feedbackRatingColor } from '../lib/feedbackRatingColors'
import { getAppPlatform } from '../lib/platform'
import { resolveModuloFromPath } from '../lib/resolveModuloFromPath'
import { showSaveToast } from '../lib/saveToast'
import { CADASTROS_ITEMS, NAV_ITEMS } from '../nav'
import { Button } from './ui/Button'
import { ErrorText } from './ui/Feedback'
import { TextArea } from './ui/TextArea'
import styles from './FeedbackOverlay.module.css'

type Props = {
  open: boolean
  onClose: () => void
  pathnameSnapshot?: string
}

const EXTRA_PATHS = [
  { path: '/perfil', label: 'Perfil' },
  { path: '/configuracoes', label: 'Configurações' },
  { path: '/plano', label: 'Plano' },
  { path: '/ajuda', label: 'Central de ajuda' },
  { path: '/relatorios', label: 'Relatórios' },
  { path: '/onboarding', label: 'Onboarding' },
  { path: '/lancamentos', label: 'Lançamentos' },
  { path: '/jornada', label: 'Jornada' },
  { path: '/retrospectiva', label: 'Retrospectiva' },
  { path: '/diagnostico', label: 'Diagnóstico' },
  { path: '/whatsapp', label: 'WhatsApp' },
  { path: '/importar', label: 'Importar' },
  { path: '/mes', label: 'Mês' },
  { path: '/console', label: 'Console' },
  { path: '/console/metodo', label: 'Console · Método' },
  { path: '/console/engajamento', label: 'Console · Engajamento' },
  { path: '/console/tendencias', label: 'Console · Tendências' },
  { path: '/console/saude', label: 'Console · Saúde' },
  { path: '/console/feedback', label: 'Console · Feedback' },
  { path: '/operacao', label: 'Operação' },
]

export function FeedbackOverlay({ open, onClose, pathnameSnapshot }: Props) {
  const location = useLocation()
  const { session } = useAuth()
  const profile = useLoad(() => familyApi.profile(), [session?.email])
  const action = useAction()
  const [nota, setNota] = useState(0)
  const [comentario, setComentario] = useState('')

  const pathItems = useMemo(
    () => [
      ...NAV_ITEMS.map((i) => ({ path: i.to, label: i.label })),
      ...CADASTROS_ITEMS.map((i) => ({ path: i.to, label: i.label })),
      ...EXTRA_PATHS,
    ],
    [],
  )

  const { modulo, rota } = useMemo(
    () => resolveModuloFromPath(pathnameSnapshot || location.pathname, pathItems, 'Geral'),
    [pathnameSnapshot, location.pathname, pathItems],
  )

  const usuarioNome = profile.data?.name?.trim() || session?.email || 'Usuário'
  const agoraLocal = new Date().toLocaleString('pt-BR')

  function resetAndClose() {
    setNota(0)
    setComentario('')
    onClose()
  }

  async function handleSubmit() {
    if (nota < 1 || nota > 5) {
      action.setError('Escolha uma nota de 1 a 5.')
      return
    }
    const texto = comentario.trim()
    if (!texto) {
      action.setError('Comentário é obrigatório.')
      return
    }
    if (texto.length > 2000) {
      action.setError('Comentário deve ter no máximo 2000 caracteres.')
      return
    }
    if (
      await action.run(() =>
        feedbackApi.submit({
          modulo,
          rota,
          plataforma: getAppPlatform(),
          nota,
          comentario: texto,
        }),
      )
    ) {
      showSaveToast('Feedback enviado. Obrigado!')
      resetAndClose()
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <p className={styles.badge}>Modo avaliação</p>
      <h2 id="feedback-title" className={styles.title}>
        Como está essa tela?
      </h2>
      <p className={styles.subtitle}>
        Sua nota e o comentário ajudam a melhorar o Conora. O módulo abaixo é o da página em que você
        estava.
      </p>
      <div className={styles.card}>
        <div>
          <span className={styles.label}>Módulo</span>
          <p className={styles.modulo}>{modulo}</p>
          <p className={styles.rota}>{rota}</p>
          <p className={styles.hint}>
            Detectado automaticamente pela rota atual · {getAppPlatform()}
          </p>
        </div>
        <div className={styles.meta}>
          <div>
            <span className={styles.label}>Você</span>
            <strong>{usuarioNome}</strong>
          </div>
          <div>
            <span className={styles.label}>Data e hora</span>
            <strong>{agoraLocal}</strong>
          </div>
        </div>
        <div>
          <span className={styles.label}>Nota</span>
          <div className={styles.stars} role="group" aria-label="Nota de 1 a 5">
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= nota
              return (
                <button
                  key={n}
                  type="button"
                  className={styles.starBtn}
                  aria-label={FEEDBACK_RATING_LABELS[n]}
                  aria-pressed={nota === n}
                  onClick={() => setNota(n)}
                  style={{ color: filled ? feedbackRatingColor(n) : undefined }}
                >
                  {filled ? '★' : '☆'}
                </button>
              )
            })}
          </div>
          {nota >= 1 ? (
            <p className={styles.ratingLabel} style={{ color: feedbackRatingColor(nota) }}>
              {FEEDBACK_RATING_LABELS[nota]}
            </p>
          ) : null}
        </div>
        <TextArea
          label="Comentário"
          name="feedbackComentario"
          value={comentario}
          onChange={(event) => setComentario(event.target.value)}
          rows={4}
          maxLength={2000}
          required
        />
        <ErrorText message={action.error} />
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={action.busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={action.busy || nota < 1 || !comentario.trim()}
          >
            {action.busy ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </div>
      <p className={styles.escHint}>Use Cancelar para fechar.</p>
    </div>
  )
}
