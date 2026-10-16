import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { familyApi, gamificationApi, monthsApi } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import { currentCompetence, formatDateTime, formatMoney } from '../lib/format'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

function closeBlockedReason(ym: string, monthCloseDay: number | undefined): string | null {
  if (ym !== currentCompetence() || !monthCloseDay) {
    return null
  }
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const closeDay = Math.min(monthCloseDay, daysInMonth)
  if (today.getDate() < closeDay) {
    return `O mês atual só pode ser fechado a partir do dia ${closeDay} (configurado em Preferências).`
  }
  return null
}

export function MonthPage() {
  const [searchParams] = useSearchParams()
  const [ym, setYm] = useState(() => searchParams.get('competenceYm') || currentCompetence())
  const [reason, setReason] = useState('')
  const [justClosed, setJustClosed] = useState(false)
  const profile = useLoad(() => familyApi.profile(), [])
  const status = useLoad(() => monthsApi.get(ym), [ym])
  const summary = useLoad(() => gamificationApi.monthSummary(ym), [ym, justClosed, status.data?.isClosed])
  const action = useAction()
  const data = status.data
  const closeSummary = summary.data
  const blockedReason = closeBlockedReason(ym, profile.data?.monthCloseDay)

  async function close() {
    if (blockedReason) {
      action.setError(blockedReason)
      return
    }
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
      setJustClosed(true)
      status.reload()
      summary.reload()
    }
  }

  async function reopen(event: FormEvent) {
    event.preventDefault()
    if (await action.run(() => monthsApi.reopen(ym, reason.trim()))) {
      showSaveToast('Mês reaberto.')
      setReason('')
      setJustClosed(false)
      status.reload()
      summary.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Fechar mês" actions={<CompetencePicker value={ym} onChange={(value) => { setYm(value); setJustClosed(false) }} />} />
      <ErrorText message={status.error ?? summary.error ?? action.error} />
      {status.loading && !data ? <Loading /> : null}

      {data ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{ym}</h2>
            <Badge tone={data.isClosed ? 'warning' : 'ok'}>{data.isClosed ? 'Fechado' : 'Aberto'}</Badge>
          </div>
          {data.closedAt ? <p className={styles.muted}>Fechado em {formatDateTime(data.closedAt)}</p> : null}

          {data.isClosed && closeSummary ? (
            <div className={styles.closeRitual}>
              <div className={styles.grid3}>
                <div className={styles.stat}>
                  <span>Renda</span>
                  <strong>{formatMoney(closeSummary.incomeTotal)}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Despesas</span>
                  <strong>{formatMoney(closeSummary.expenseTotal)}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Resultado</span>
                  <strong className={closeSummary.result < 0 ? styles.negative : styles.positive}>
                    {formatMoney(closeSummary.result)}
                  </strong>
                </div>
              </div>
              <p className={styles.muted}>
                {closeSummary.withinBudget ? 'Dentro do orçamento.' : 'Acima do orçamento neste mês.'}
              </p>
              {closeSummary.celebrationMessage ? (
                <p className={styles.celebration}>{closeSummary.celebrationMessage}</p>
              ) : null}
              {closeSummary.nextStep ? (
                <p className={styles.muted}>
                  Próximo passo:{' '}
                  <Link to={closeSummary.nextStep.route}>{closeSummary.nextStep.title}</Link>
                </p>
              ) : null}
            </div>
          ) : null}

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
              {blockedReason ? <p className={styles.muted}>{blockedReason}</p> : null}
              <Button disabled={action.busy || Boolean(blockedReason)} onClick={() => void close()}>
                Fechar mês
              </Button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
