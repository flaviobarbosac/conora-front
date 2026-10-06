import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { toneFromSeverity } from '../lib/severity'
import { currentCompetence, formatMoney } from '../lib/format'
import styles from './page.module.css'

export function HomePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [ym, setYm] = useState(currentCompetence)
  const dashboard = useLoad(() => dashboardApi.get(ym), [ym])
  const name = session?.email?.split('@')[0] ?? ''
  const data = dashboard.data

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Início"
        title={`Olá${name ? `, ${name}` : ''}`}
        actions={
          <>
            <CompetencePicker value={ym} onChange={setYm} />
            <Button onClick={() => navigate('/lancamentos')}>+ Novo lançamento</Button>
          </>
        }
      />
      <ErrorText message={dashboard.error} />
      {dashboard.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.hero}>
            <span>Resultado do mês{data.isClosed ? ' (mês fechado)' : ''}</span>
            <strong className={data.result < 0 ? styles.negative : undefined}>{formatMoney(data.result)}</strong>
            <span>Receitas menos despesas em {ym}.</span>
          </section>
          <div className={styles.grid3}>
            <div className={styles.stat}>
              <span>Receitas</span>
              <strong>{formatMoney(data.incomeTotal)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Despesas</span>
              <strong>{formatMoney(data.expenseTotal)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Saldo em contas</span>
              <strong>{formatMoney(data.accountsBalance)}</strong>
            </div>
          </div>
          <div className={styles.grid3}>
            <div className={styles.stat}>
              <span>Compras no cartão</span>
              <strong>{formatMoney(data.cardPurchasesTotal)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Aportes em projetos</span>
              <strong>{formatMoney(data.projectContributionsTotal)}</strong>
            </div>
            <div className={styles.stat}>
              <span>Receita recebida</span>
              <strong>{formatMoney(data.receivedIncome)}</strong>
            </div>
          </div>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Alertas</h2>
            {data.alerts.length === 0 ? (
              <p className={styles.muted}>Nenhum alerta para esta competência.</p>
            ) : (
              <ul className={styles.list}>
                {data.alerts.map((alert) => (
                  <li key={`${alert.code}-${alert.categoryId ?? ''}`} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>
                        <Icon name="alert" size={16} /> {alert.message}
                      </strong>
                    </span>
                    <Badge tone={toneFromSeverity(alert.severity)}>
                      {alert.percent !== null ? `${Math.round(alert.percent)}%` : alert.severity}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
