import { useMemo, useState, type FormEvent } from 'react'
import { auditApi, feedbackApi, type AuditEvent } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { showSaveToast } from '../lib/saveToast'
import { formatDate } from '../lib/format'
import styles from './page.module.css'

export function AdminPage() {
  const [tab, setTab] = useState<'audit' | 'feedback'>('audit')
  const events = useLoad(() => auditApi.list(undefined, undefined, 0, 50), [])
  const feedback = useLoad(() => auditApi.list('UserFeedback', undefined, 0, 50), [])

  const list = tab === 'audit' ? events : feedback
  const items = useMemo(() => list.data?.items ?? [], [list.data])

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Operação" />
      <p className={styles.muted}>
        Eventos de auditoria do workspace, feedback dos usuários e saúde da API. Sem gateway de pagamento
        nesta tela.
      </p>
      <div className={styles.segmented} role="group" aria-label="Visão">
        <button type="button" aria-pressed={tab === 'audit'} onClick={() => setTab('audit')}>
          Auditoria
        </button>
        <button type="button" aria-pressed={tab === 'feedback'} onClick={() => setTab('feedback')}>
          Feedback
        </button>
      </div>
      <ErrorText message={list.error} />
      {list.loading && !list.data ? <Loading /> : null}
      {!list.loading && items.length === 0 ? <Empty>Nenhum evento.</Empty> : null}
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <AuditRow key={`${item.id}-${item.timestampUtc}`} item={item} />
          ))}
        </ul>
      ) : null}
      <FeedbackForm onSent={() => feedback.reload()} />
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

function FeedbackForm({ onSent }: { onSent: () => void }) {
  const [tried, setTried] = useState('')
  const [blocked, setBlocked] = useState('')
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await action.run(() => feedbackApi.submit(tried.trim(), blocked.trim()))) {
      showSaveToast('Feedback enviado.')
      setTried('')
      setBlocked('')
      onSent()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Enviar feedback</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field
            label="O que você tentou fazer?"
            name="feedbackTried"
            value={tried}
            onChange={(event) => setTried(event.target.value)}
            required
          />
        </div>
        <div className={styles.formWide}>
          <Field
            label="O que travou?"
            name="feedbackBlocked"
            value={blocked}
            onChange={(event) => setBlocked(event.target.value)}
            required
          />
        </div>
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Enviar
          </Button>
        </div>
      </form>
    </section>
  )
}
