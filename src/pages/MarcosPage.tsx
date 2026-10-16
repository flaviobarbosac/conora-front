import { gamificationApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { formatDateTime } from '../lib/format'
import styles from './page.module.css'

export function MarcosPage() {
  const data = useLoad(() => gamificationApi.achievements(), [])
  const items = data.data?.items ?? []
  const quiet = data.data?.quietMode

  return (
    <div className={styles.page}>
      <PageHeader kicker="Cadastros" title="Marcos" />
      <ErrorText message={data.error} />
      {data.loading && !data.data ? <Loading /> : null}

      {data.data && items.length === 0 ? <Empty>Nenhum marco cadastrado ainda.</Empty> : null}

      {quiet ? (
        <p className={styles.muted}>Modo silencioso ativo: os marcos ficam sem celebração.</p>
      ) : null}

      {items.length > 0 ? (
        <ul className={styles.marcoGrid} aria-label="Marcos do método">
          {items.map((item) => (
            <li
              key={item.key}
              className={`${styles.marcoCard} ${item.earned ? styles.marcoCardEarned : styles.marcoCardPending}`}
            >
              <div className={styles.marcoCardHead}>
                <strong>{item.title}</strong>
                <Badge tone={item.earned ? 'ok' : 'info'}>{item.earned ? 'Conquistado' : 'Pendente'}</Badge>
              </div>
              <p className={styles.muted}>{item.description}</p>
              {item.earned && item.earnedAt ? (
                <p className={styles.muted}>Em {formatDateTime(item.earnedAt)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
