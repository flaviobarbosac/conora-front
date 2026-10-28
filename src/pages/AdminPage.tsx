import { useMemo } from 'react'
import { auditApi, type AuditEvent } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { formatDate } from '../lib/format'
import styles from './page.module.css'

export function AdminPage() {
  const events = useLoad(() => auditApi.list(undefined, undefined, 0, 50), [])
  const items = useMemo(() => events.data?.items ?? [], [events.data])

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Operação" />
      <p className={styles.muted}>
        Eventos de auditoria do workspace e saúde da API. Feedback dos usuários fica no console
        administrativo.
      </p>
      <ErrorText message={events.error} />
      {events.loading && !events.data ? <Loading /> : null}
      {!events.loading && items.length === 0 ? <Empty>Nenhum evento.</Empty> : null}
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <AuditRow key={`${item.id}-${item.timestampUtc}`} item={item} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function AuditRow({ item }: { item: AuditEvent }) {
  return (
    <li className={styles.row}>
      <span className={styles.rowMain}>
        <strong>
          {item.entityName} · {item.action}
        </strong>
        <span className={styles.rowSub}>
          {formatDate(item.timestampUtc)} · {item.actor || '—'}
        </span>
        {item.detailsJson ? <span className={styles.rowSub}>{item.detailsJson}</span> : null}
      </span>
    </li>
  )
}
