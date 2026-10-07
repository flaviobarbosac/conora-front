import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardApi, familyApi } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Skeleton } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { toneFromSeverity } from '../lib/severity'
import { scanReceipt } from '../camera/scanReceipt'
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
  const profile = useLoad(() => familyApi.profile(), [])
  const name = firstName(profile.data?.name)
  const data = dashboard.data
  const emptyMonth = data && data.incomeTotal === 0 && data.expenseTotal === 0

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

      <ErrorText message={dashboard.error} />

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
          <section className={styles.hero} aria-labelledby="month-result">
            <div className={styles.heroTop}>
              <span id="month-result">Resultado de {ym}</span>
              {data.isClosed ? <Badge tone="info">Mês fechado</Badge> : null}
            </div>
            <strong className={data.result < 0 ? styles.negative : data.result > 0 ? styles.positive : undefined}>
              {formatMoney(data.result)}
            </strong>
            <div className={styles.heroSplit} aria-label="Resumo de receitas e despesas">
              <div>
                <span>Receitas</span>
                <strong className={styles.positive}>{formatMoney(data.incomeTotal)}</strong>
              </div>
              <div>
                <span>Despesas</span>
                <strong className={styles.negative}>{formatMoney(data.expenseTotal)}</strong>
              </div>
            </div>
          </section>

          {emptyMonth ? (
            <section className={styles.emptyCard}>
              <h2>Comece pelo mês</h2>
              <p className={styles.muted}>
                Ainda não há lançamentos em {ym}. Registre a primeira receita ou despesa para ver o painel ganhar vida.
              </p>
              <div className={styles.quickActions}>
                <Button onClick={() => navigate('/lancamentos?novo=1')}>Registrar lançamento</Button>
                <Button variant="secondary" onClick={() => navigate('/orcamento')}>
                  Ver orçamento
                </Button>
              </div>
            </section>
          ) : (
            <>
              <nav className={styles.quickActions} aria-label="Atalhos">
                <Button variant="secondary" className={styles.quickChip} onClick={() => navigate('/lancamentos?novo=1')}>
                  <Icon name="add" size={20} /> Lançar
                </Button>
                <Button
                  variant="secondary"
                  className={styles.quickChip}
                  onClick={() => {
                    void scanReceipt()
                      .then(() => navigate('/compartilhar'))
                      .catch(() => undefined)
                  }}
                >
                  <Icon name="add" size={20} /> Escanear
                </Button>
                <Button variant="secondary" className={styles.quickChip} onClick={() => navigate('/orcamento')}>
                  <Icon name="budget" size={20} /> Orçamento
                </Button>
                <Button variant="secondary" className={styles.quickChip} onClick={() => navigate('/diagnostico')}>
                  <Icon name="search" size={20} /> Diagnóstico
                </Button>
                <Button variant="secondary" className={styles.quickChip} onClick={() => navigate('/contas')}>
                  <Icon name="card" size={20} /> Contas
                </Button>
              </nav>

              <div className={styles.grid3}>
                <div className={styles.stat}>
                  <span>Saldo em contas</span>
                  <strong>{formatMoney(data.accountsBalance)}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Já recebido</span>
                  <strong className={styles.positive}>{formatMoney(data.receivedIncome)}</strong>
                </div>
                <div className={styles.stat}>
                  <span>Cartão no mês</span>
                  <strong className={styles.negative}>{formatMoney(data.cardPurchasesTotal)}</strong>
                </div>
              </div>

              {data.projectContributionsTotal > 0 ? (
                <div className={styles.stat}>
                  <span>Aportes em projetos</span>
                  <strong>{formatMoney(data.projectContributionsTotal)}</strong>
                </div>
              ) : null}
            </>
          )}

          <section className={styles.section} aria-labelledby="alerts-title">
            <div className={styles.sectionHead}>
              <h2 id="alerts-title" className={styles.sectionTitle}>
                Alertas
              </h2>
              {data.alerts.length > 0 ? (
                <Link to="/orcamento" className={styles.sectionLink}>
                  Ver orçamento
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
                    <li key={`${alert.code}-${alert.categoryId ?? ''}`} className={`${styles.alertRow} ${styles[`alertRow_${tone}`]}`}>
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
