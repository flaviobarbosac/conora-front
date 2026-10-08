import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { budgetsApi, dashboardApi, familyApi } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Skeleton } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { toneFromSeverity } from '../lib/severity'
import { currentCompetence, formatMoney } from '../lib/format'
import styles from './page.module.css'

function firstName(fullName: string | undefined): string {
  const trimmed = fullName?.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.split(/\s+/).find(Boolean) ?? trimmed
}

export function HomePage() {
  const navigate = useNavigate()
  const [ym, setYm] = useState(currentCompetence)
  const dashboard = useLoad(() => dashboardApi.get(ym), [ym])
  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const profile = useLoad(() => familyApi.profile(), [])
  const name = firstName(profile.data?.name)
  const data = dashboard.data
  const emptyMonth = data && data.incomeTotal === 0 && data.expenseTotal === 0
  const riskAlert = data?.alerts.find((alert) => alert.severity === 'Exceeded' || alert.severity === 'Attention')

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Início"
        title={name ? `Olá, ${name}` : 'Olá'}
        actions={
          <>
            <CompetencePicker value={ym} onChange={setYm} />
            <Button onClick={() => navigate('/lancamentos?novo=1')}>Novo lançamento</Button>
          </>
        }
      />

      <ErrorText message={dashboard.error ?? budget.error} />

      {dashboard.loading && !data ? (
        <div className={styles.skeletonStack} aria-busy="true" aria-live="polite">
          <Skeleton height={140} />
          <div className={styles.grid3}>
            <Skeleton height={96} />
            <Skeleton height={96} />
            <Skeleton height={96} />
          </div>
        </div>
      ) : null}

      {data ? (
        <>
          <section className={styles.hero} aria-labelledby="day-photo">
            <div className={styles.heroTop}>
              <span id="day-photo">Foto do dia · {ym}</span>
              {data.isClosed ? <Badge tone="info">Mês fechado</Badge> : null}
            </div>
            <div className={styles.heroSplit} aria-label="Saldo e previsão">
              <div>
                <span>Saldo atual</span>
                <strong className={data.accountsBalance < 0 ? styles.negative : styles.positive}>
                  {formatMoney(data.accountsBalance)}
                </strong>
              </div>
              <div>
                <span>Previsão do mês</span>
                <strong className={data.result < 0 ? styles.negative : undefined}>
                  {formatMoney(budget.data?.monthResult ?? data.result)}
                </strong>
              </div>
            </div>
            {riskAlert ? (
              <p className={styles.muted}>
                Alerta: {riskAlert.message}
                {data.accountsBalance < 0 ? ' · atenção ao uso de limite/cheque especial.' : ''}
              </p>
            ) : data.accountsBalance < 0 ? (
              <p className={styles.muted}>Saldo negativo: revise o uso de limite ou cheque especial.</p>
            ) : null}
          </section>

          <nav className={styles.homeBlocks} aria-label="Atalhos principais">
            <Link className={styles.homeBlock} to="/orcamento">
              <Icon name="budget" size={24} />
              <strong>Raio-X</strong>
              <span>Previsto × realizado do mês</span>
            </Link>
            <Link className={styles.homeBlock} to="/patrimonio">
              <Icon name="wallet" size={24} />
              <strong>Patrimônio</strong>
              <span>Ativo, passivo e líquido</span>
            </Link>
            <Link className={styles.homeBlock} to="/relatorios">
              <Icon name="search" size={24} />
              <strong>Relatórios</strong>
              <span>Visões e evolução</span>
            </Link>
            <Link className={styles.homeBlock} to="/lancamentos?novo=1">
              <Icon name="add" size={24} />
              <strong>Lançar</strong>
              <span>Registrar receita ou despesa</span>
            </Link>
          </nav>

          {emptyMonth ? (
            <section className={styles.emptyCard}>
              <h2>Comece pelo mês</h2>
              <p className={styles.muted}>
                Ainda não há lançamentos em {ym}. Registre a primeira receita ou despesa para ver o painel ganhar vida.
              </p>
              <div className={styles.quickActions}>
                <Button onClick={() => navigate('/lancamentos?novo=1')}>Registrar lançamento</Button>
                <Button variant="secondary" onClick={() => navigate('/orcamento')}>
                  Ver Raio-X
                </Button>
              </div>
            </section>
          ) : (
            <div className={styles.grid3}>
              <div className={styles.stat}>
                <span>Já recebido</span>
                <strong className={styles.positive}>{formatMoney(data.receivedIncome)}</strong>
              </div>
              <div className={styles.stat}>
                <span>Despesas</span>
                <strong className={styles.negative}>{formatMoney(data.expenseTotal)}</strong>
              </div>
              <div className={styles.stat}>
                <span>Cartão no mês</span>
                <strong className={styles.negative}>{formatMoney(data.cardPurchasesTotal)}</strong>
              </div>
            </div>
          )}

          <section className={styles.section} aria-labelledby="alerts-title">
            <div className={styles.sectionHead}>
              <h2 id="alerts-title" className={styles.sectionTitle}>
                Alertas
              </h2>
              {data.alerts.length > 0 ? (
                <Link to="/orcamento" className={styles.sectionLink}>
                  Ver Raio-X
                </Link>
              ) : null}
            </div>
            {data.alerts.length === 0 ? (
              <p className={styles.muted}>Tudo em ordem nesta competência.</p>
            ) : (
              <ul className={styles.alertList}>
                {data.alerts.map((alert) => {
                  const tone = toneFromSeverity(alert.severity)
                  return (
                    <li key={`${alert.code}-${alert.chartAccountId ?? ''}`} className={`${styles.alertRow} ${styles[`alertRow_${tone}`]}`}>
                      <span className={styles.alertIcon} aria-hidden="true">
                        <Icon name="alert" size={20} />
                      </span>
                      <span className={styles.rowMain}>
                        <strong>{alert.message}</strong>
                      </span>
                      <Badge tone={tone}>
                        {alert.percent !== null ? `${Math.round(alert.percent)}%` : alert.severity}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
