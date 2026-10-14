import { useMemo, useState } from 'react'
import { gamificationApi } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { formatMoney, formatPercent } from '../lib/format'
import { showSaveToast } from '../lib/saveToast'
import styles from './page.module.css'

async function shareText(payload: { title: string; text: string }) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share(payload)
    return
  }
  await navigator.clipboard.writeText(payload.text)
  showSaveToast('Resumo copiado.')
}

export function RetrospectivePage() {
  const [year, setYear] = useState(() => new Date().getUTCFullYear())
  const data = useLoad(() => gamificationApi.retrospective(year), [year])
  const report = data.data

  const shareBody = useMemo(() => {
    if (!report) return ''
    const lines = [
      `Conora · Retrospectiva ${report.year}`,
      `${report.closedMonths} meses fechados`,
      `${report.withinBudgetMonths} meses dentro do orçamento`,
    ]
    for (const achievement of report.achievements.filter((item) => item.earned)) {
      lines.push(`Marco: ${achievement.title}`)
    }
    if (report.includeAbsoluteValues) {
      for (const month of report.months.filter((item) => item.isClosed)) {
        lines.push(
          `${month.competenceYm}: resultado ${month.result == null ? '—' : formatMoney(month.result)}`,
        )
      }
    }
    return lines.join('\n')
  }, [report])

  return (
    <div className={styles.page}>
      <PageHeader
        secondary
        title="Retrospectiva anual"
        actions={
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setYear((value) => value - 1)}>
              Ano anterior
            </Button>
            <Button variant="secondary" onClick={() => setYear((value) => value + 1)}>
              Próximo ano
            </Button>
            <Button
              variant="secondary"
              disabled={!shareBody}
              onClick={() => void shareText({ title: `Retrospectiva ${year}`, text: shareBody })}
            >
              Compartilhar
            </Button>
          </div>
        }
      />
      <ErrorText message={data.error} />
      {data.loading && !report ? <Loading /> : null}

      {report ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{report.year}</h2>
            <p className={styles.muted}>
              {report.closedMonths} meses fechados · {report.withinBudgetMonths} dentro do orçamento
              {report.includeAbsoluteValues ? '' : ' · valores absolutos ocultos'}
            </p>
            {!report.quietMode && report.achievements.some((item) => item.earned) ? (
              <ul className={styles.achievementList}>
                {report.achievements
                  .filter((item) => item.earned)
                  .map((item) => (
                    <li key={item.key} className={styles.achievementEarned}>
                      <strong>{item.title}</strong>
                      <span className={styles.muted}>{item.description}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
          </section>

          <section className={styles.section}>
            <ul className={styles.list}>
              {report.months.map((month) => (
                <li key={month.competenceYm} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>{month.competenceYm}</strong>
                    <span className={styles.muted}>
                      {month.isClosed
                        ? month.withinBudget
                          ? 'Fechado no orçamento'
                          : 'Fechado'
                        : 'Aberto'}
                    </span>
                  </span>
                  {report.includeAbsoluteValues && month.result != null ? (
                    <span className={styles.amount}>{formatMoney(month.result)}</span>
                  ) : (
                    <span className={styles.amount}>
                      {month.isClosed ? (month.withinBudget ? formatPercent(100) : '—') : '—'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
