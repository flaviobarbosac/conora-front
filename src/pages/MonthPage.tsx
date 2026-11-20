import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { budgetsApi, familyApi, gamificationApi, monthsApi, pendingDebtsApi } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import { currentCompetence, formatDateTime, formatMoney } from '../lib/format'
import {
  budgetOverAmount,
  sumDebtAndSurplus,
  sumNewDebt,
  topLeakages,
  topUnposted,
} from '../lib/monthClosePreview'
import { requestAppReview } from '../lib/appReview'
import { showSaveToast } from '../lib/saveToast'
import styles from './pageStyles'

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
  const [debtIds, setDebtIds] = useState<string[]>([])
  const profile = useLoad(() => familyApi.profile(), [])
  const status = useLoad(() => monthsApi.get(ym), [ym])
  const gaps = useLoad(() => monthsApi.unpaid(ym), [ym, status.data?.isClosed])
  const summary = useLoad(() => gamificationApi.monthSummary(ym), [ym, justClosed, status.data?.isClosed])
  const closePreview = useLoad(
    () => (status.data?.isClosed ? Promise.resolve(null) : monthsApi.closePreviewSummary(ym)),
    [ym, status.data?.isClosed],
  )
  const budget = useLoad(() => budgetsApi.get(ym).catch(() => null), [ym])
  const openDebts = useLoad(() => pendingDebtsApi.list(), [ym, justClosed, status.data?.isClosed])
  const action = useAction()
  const data = status.data
  const closeSummary = summary.data
  const closedWell = justClosed && !!closeSummary && (closeSummary.withinBudget || !!closeSummary.celebrationMessage)

  // A month just closed inside the budget is the best moment to ask for a store review.
  useEffect(() => {
    if (closedWell) requestAppReview()
  }, [closedWell])
  const blockedReason = closeBlockedReason(ym, profile.data?.monthCloseDay)
  const gapRows = gaps.data ?? []
  const { debtTotal, surplusTotal } = useMemo(
    () => sumDebtAndSurplus(gapRows, debtIds),
    [gapRows, debtIds],
  )
  const newDebtTotal = useMemo(() => sumNewDebt(gapRows, debtIds), [gapRows, debtIds])
  const priorDebtTotal = useMemo(
    () => (openDebts.data ?? []).reduce((sum, debt) => sum + debt.openAmount, 0),
    [openDebts.data],
  )
  const leakages = useMemo(
    () => topLeakages(budget.data?.lines ?? [], 3),
    [budget.data?.lines],
  )
  const unposted = useMemo(
    () => topUnposted(budget.data?.lines ?? [], 5),
    [budget.data?.lines],
  )
  const overBudget = budget.data
    ? budgetOverAmount(budget.data.totalPlanned, budget.data.totalActual)
    : 0
  const journeyNext = closeSummary?.quietMode ? null : closeSummary?.nextStep ?? null
  const previewNext =
    debtTotal > 0 || priorDebtTotal > 0
      ? { title: 'Ver dívidas no Raio-X', route: '/raio-x' }
      : journeyNext

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
    if (await action.run(() => monthsApi.close(ym, debtIds))) {
      showSaveToast('Mês fechado.')
      setJustClosed(true)
      setDebtIds([])
      status.reload()
      summary.reload()
      gaps.reload()
      openDebts.reload()
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
      gaps.reload()
      openDebts.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Fechar mês"
        backTo={{ to: '/orcamento', label: '← Orçamento' }}
        actions={<CompetencePicker value={ym} onChange={(value) => { setYm(value); setJustClosed(false); setDebtIds([]) }} />}
      />
      <ErrorText message={status.error ?? summary.error ?? closePreview.error ?? action.error} />
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

              {closePreview.data?.summary ? (
                <div className={styles.closeRitual}>
                  <h3 className={styles.sectionTitle}>Leitura do mês</h3>
                  <p className={styles.celebration}>{closePreview.data.summary}</p>
                </div>
              ) : closePreview.loading ? (
                <p className={styles.muted}>Montando a leitura do mês…</p>
              ) : null}

              {closeSummary ? (
                <div className={styles.closeRitual}>
                  <h3 className={styles.sectionTitle}>Prévia do mês</h3>
                  <div className={styles.grid3}>
                    <div className={styles.stat}>
                      <span>Resultado</span>
                      <strong className={closeSummary.result < 0 ? styles.negative : styles.positive}>
                        {formatMoney(closeSummary.result)}
                      </strong>
                    </div>
                    <div className={styles.stat}>
                      <span>Orçamento</span>
                      <strong>
                        {closeSummary.withinBudget
                          ? 'Dentro'
                          : overBudget > 0
                            ? `Acima · ${formatMoney(overBudget)}`
                            : 'Acima'}
                      </strong>
                    </div>
                    <div className={styles.stat}>
                      <span>Renda / despesa</span>
                      <strong>
                        {formatMoney(closeSummary.incomeTotal)} / {formatMoney(closeSummary.expenseTotal)}
                      </strong>
                    </div>
                  </div>
                  {gapRows.length > 0 ? (
                    <div className={styles.grid3}>
                      <div className={styles.stat}>
                        <span>Vira dívida</span>
                        <strong>{formatMoney(debtTotal)}</strong>
                      </div>
                      <div className={styles.stat}>
                        <span>Continua sobra</span>
                        <strong>{formatMoney(surplusTotal)}</strong>
                      </div>
                      <div className={styles.stat}>
                        <span>Dívidas em aberto</span>
                        <strong>{formatMoney(priorDebtTotal)}</strong>
                      </div>
                    </div>
                  ) : priorDebtTotal > 0 ? (
                    <p className={styles.muted}>
                      Dívidas em aberto de meses anteriores: {formatMoney(priorDebtTotal)}.
                    </p>
                  ) : null}
                  {newDebtTotal > 0 ? (
                    <p className={styles.muted}>
                      Neste fechamento entram {formatMoney(newDebtTotal)} como dívida nova.
                      {priorDebtTotal > 0
                        ? ` Já havia ${formatMoney(priorDebtTotal)} em aberto.`
                        : ''}
                    </p>
                  ) : null}
                  {leakages.length > 0 ? (
                    <div>
                      <p className={styles.sectionTitle}>Onde mais estourou</p>
                      <ul className={styles.budgetResult}>
                        {leakages.map((row) => (
                          <li key={row.categoryId}>
                            <span>{row.categoryName}</span>
                            <span className={styles.moneyValue}>
                              +{formatMoney(row.overAmount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {unposted.length > 0 ? (
                    <div>
                      <p className={styles.sectionTitle}>Previsto sem lançamento</p>
                      <ul className={styles.budgetResult}>
                        {unposted.map((row) => (
                          <li key={row.categoryId}>
                            <span>{row.categoryName}</span>
                            <span className={styles.moneyValue}>{formatMoney(row.plannedAmount)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className={styles.muted}>
                        Marque abaixo o que é dívida. O restante continua sobra.
                      </p>
                    </div>
                  ) : null}
                  {previewNext ? (
                    <p className={styles.muted}>
                      Depois de fechar:{' '}
                      <Link to={previewNext.route}>{previewNext.title}</Link>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {gapRows.length > 0 ? (
                <fieldset className={styles.form}>
                  <legend className={styles.sectionTitle}>Contas em aberto</legend>
                  <p className={styles.muted}>Marque o que é dívida. O que ficar sem marca continua sobra.</p>
                  {gapRows.map((gap) => (
                    <label key={gap.categoryId} className={styles.formWide}>
                      <input
                        type="checkbox"
                        disabled={gap.alreadyRegistered}
                        checked={gap.alreadyRegistered || debtIds.includes(gap.categoryId)}
                        onChange={(event) => {
                          setDebtIds((current) =>
                            event.target.checked
                              ? [...current, gap.categoryId]
                              : current.filter((id) => id !== gap.categoryId),
                          )
                        }}
                      />{' '}
                      {gap.categoryName} · {formatMoney(gap.openAmount)}
                      {gap.alreadyRegistered ? ' · já registrada' : null}
                    </label>
                  ))}
                </fieldset>
              ) : null}

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
