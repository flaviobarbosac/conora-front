import { useParams } from 'react-router-dom'
import { feedbackApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { formatDate } from '../lib/format'
import { FEEDBACK_RATING_LABELS, feedbackRatingColor } from '../lib/feedbackRatingColors'
import styles from './pageStyles'

export function FeedbackRespostaPage() {
  const { id } = useParams<{ id: string }>()
  const load = useLoad(() => feedbackApi.getMine(id!), [id])
  const item = load.data

  return (
    <div className={styles.page}>
      <PageHeader title="Resposta ao feedback" backTo={{ to: '/', label: '← Início' }} />
      <ErrorText message={load.error} />
      {load.loading && !item ? <Loading /> : null}
      {item ? (
        <section className={styles.section}>
          <p className={styles.muted}>
            {formatDate(item.createdAt)} · {item.modulo}
            {item.rota ? ` · ${item.rota}` : ''}
          </p>
          <p style={{ color: feedbackRatingColor(item.nota), fontWeight: 600 }}>
            {item.nota} ★ · {FEEDBACK_RATING_LABELS[item.nota] ?? item.nota}
          </p>
          <p>{item.comentario}</p>
          {item.resposta ? (
            <>
              <h2 className={styles.sectionTitle}>Nossa resposta</h2>
              <p>{item.resposta}</p>
              {item.respondidoEm ? (
                <p className={styles.muted}>{formatDate(item.respondidoEm)}</p>
              ) : null}
            </>
          ) : (
            <p className={styles.muted}>Ainda não há resposta para este feedback.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
