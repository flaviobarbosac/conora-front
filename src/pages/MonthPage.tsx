import { useState, type FormEvent } from 'react'
import { monthsApi } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { currentCompetence, formatDateTime } from '../lib/format'
import styles from './page.module.css'

export function MonthPage() {
  const [ym, setYm] = useState(currentCompetence)
  const [reason, setReason] = useState('')
  const status = useLoad(() => monthsApi.get(ym), [ym])
  const action = useAction()
  const data = status.data

  async function close() {
    if (
      !(await confirmDestructive(`Fechar ${ym}? Lançamentos ficam bloqueados até reabrir.`, {
        title: 'Fechar mês',
        confirmLabel: 'Fechar',
        danger: true,
      }))
    ) {
      return
    }
    if (await action.run(() => monthsApi.close(ym))) {
      showSaveToast('Mês fechado.')
      status.reload()
    }
  }

  async function reopen(event: FormEvent) {
    event.preventDefault()
    if (await action.run(() => monthsApi.reopen(ym, reason.trim()))) {
      showSaveToast('Mês reaberto.')
      setReason('')
      status.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Fechar mês" actions={<CompetencePicker value={ym} onChange={setYm} />} />
      <ErrorText message={status.error ?? action.error} />
      {status.loading && !data ? <Loading /> : null}
      {data ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{ym}</h2>
            <Badge tone={data.isClosed ? 'warning' : 'ok'}>{data.isClosed ? 'Fechado' : 'Aberto'}</Badge>
          </div>
          {data.closedAt ? <p className={styles.muted}>Fechado em {formatDateTime(data.closedAt)}</p> : null}
          {data.reopenReason ? <p className={styles.muted}>Último motivo de reabertura: {data.reopenReason}</p> : null}
          {data.isClosed ? (
            <form className={styles.form} onSubmit={(event) => void reopen(event)}>
              <div className={styles.formWide}>
                <Field label="Motivo da reabertura" name="reason" required value={reason} onChange={(event) => setReason(event.target.value)} />
              </div>
              <div className={styles.formActions}>
                <Button type="submit" disabled={action.busy}>
                  Reabrir mês
                </Button>
              </div>
            </form>
          ) : (
            <div className={styles.actions}>
              <Button disabled={action.busy} onClick={() => void close()}>
                Fechar mês
              </Button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
