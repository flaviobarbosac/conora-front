import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  budgetsApi,
  dashboardApi,
  familyApi,
  patrimonyApi,
  projectsApi,
  type Budget,
  type LifeProject,
  type PatrimonySummary,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, ErrorText, Skeleton } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { currentCompetence, formatMoney, formatPercent } from '../lib/format'
import {
  buildBudgetMacroBars,
  buildPatrimonyHomeInsight,
  buildPatrimonyMacroBars,
  buildRaioXHomeInsight,
} from '../lib/homeInsights'
import { horizonFillClass, LIFE_HORIZONS } from '../lib/lifeHorizon'
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
  const patrimony = useLoad(() => patrimonyApi.get(), [])
  const projects = useLoad(() => projectsApi.list(), [])
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

      <ErrorText message={dashboard.error ?? budget.error ?? patrimony.error ?? projects.error} />

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
                <strong
                  className={`${styles.moneyValue} ${data.accountsBalance < 0 ? styles.negative : styles.positive}`}
                >
                  {formatMoney(data.accountsBalance)}
                </strong>
              </div>
              <div>
                <span>Previsão do mês</span>
                <strong className={`${styles.moneyValue} ${data.result < 0 ? styles.negative : ''}`}>
                  {formatMoney(budget.data?.monthResult ?? data.result)}
                </strong>
              </div>
            </div>
            {data.accountsBalance < 0 ? (
              <p className={styles.muted}>Saldo negativo: revise o uso de limite ou cheque especial.</p>
            ) : null}
          </section>

          <section className={styles.macroGrid} aria-label="Visão macro">
            <BudgetMacroChart budget={budget.data} loading={budget.loading && !budget.data} />
            <PatrimonyMacroChart summary={patrimony.data} loading={patrimony.loading && !patrimony.data} />
          </section>

          <nav className={styles.homeBlocks} aria-label="Atalhos principais">
            <ProjectsHomeTile projects={projects.data ?? []} loading={projects.loading && !projects.data} />
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
                <Button variant="secondary" onClick={() => navigate('/raio-x')}>
                  Ver Raio-X
                </Button>
              </div>
            </section>
          ) : (
            <div className={styles.grid3}>
              <div className={styles.stat}>
                <span>Já recebido</span>
                <strong className={`${styles.moneyValue} ${styles.positive}`}>
                  {formatMoney(data.receivedIncome)}
                </strong>
              </div>
              <div className={styles.stat}>
                <span>Despesas</span>
                <strong className={`${styles.moneyValue} ${styles.negative}`}>
                  {formatMoney(data.expenseTotal)}
                </strong>
              </div>
              <div className={styles.stat}>
                <span>Cartão no mês</span>
                <strong className={`${styles.moneyValue} ${styles.negative}`}>
                  {formatMoney(data.cardPurchasesTotal)}
                </strong>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function BudgetMacroChart({ budget, loading }: { budget: Budget | null | undefined; loading: boolean }) {
  const insight = useMemo(() => (budget ? buildRaioXHomeInsight(budget) : null), [budget])
  const bars = useMemo(() => (budget ? buildBudgetMacroBars(budget) : []), [budget])

  return (
    <section className={styles.macroCard}>
      <div className={styles.macroHead}>
        <Link className={styles.homeBlockProjectsHead} to="/raio-x">
          <Icon name="budget" size={24} />
          <strong>Orçamento</strong>
        </Link>
        {insight ? (
          <span className={styles.macroHeadMeta}>
            {insight.monthPercent === null ? 'Sem orçamento' : formatPercent(insight.monthPercent)} ·{' '}
            <span className={styles.moneyValue}>
              {formatMoney(insight.actual)} / {formatMoney(insight.planned)}
            </span>
          </span>
        ) : null}
      </div>
      {loading ? <Skeleton height={120} /> : null}
      {!loading && bars.length === 0 ? (
        <p className={styles.muted}>Defina o orçamento do mês para ver o previsto × realizado.</p>
      ) : null}
      {!loading && bars.length > 0 ? (
        <ul className={styles.macroBars}>
          {bars.map((bar) => (
            <li key={bar.section}>
              <Link className={styles.macroBarLink} to={`/raio-x?section=${encodeURIComponent(bar.section)}`}>
                <span className={styles.macroBarLabel}>
                  <strong>{bar.name}</strong>
                  <span className={styles.moneyValue}>
                    {formatMoney(bar.actual)} / {formatMoney(bar.planned)}
                  </span>
                </span>
                <span className={styles.progress} aria-hidden>
                  <span
                    className={`${styles.progressFill} ${
                      bar.tone === 'over'
                        ? styles.progressFill_danger
                        : bar.tone === 'muted'
                          ? styles.progressFillMuted
                          : styles.progressFillActual
                    }`}
                    style={{ width: `${bar.progressPct}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function PatrimonyMacroChart({
  summary,
  loading,
}: {
  summary: PatrimonySummary | null | undefined
  loading: boolean
}) {
  const insight = summary ? buildPatrimonyHomeInsight(summary) : null
  const bars = summary ? buildPatrimonyMacroBars(summary) : []

  return (
    <section className={styles.macroCard}>
      <div className={styles.macroHead}>
        <Link className={styles.homeBlockProjectsHead} to="/patrimonio">
          <Icon name="wallet" size={24} />
          <strong>Patrimônio</strong>
        </Link>
        {insight ? (
          <span className={`${styles.macroHeadMeta} ${styles.moneyValue} ${insight.netWorth < 0 ? styles.negative : ''}`}>
            Líquido {formatMoney(insight.netWorth)}
          </span>
        ) : null}
      </div>
      {loading ? <Skeleton height={96} /> : null}
      {!loading && bars.length > 0 ? (
        <ul className={styles.macroBars}>
          {bars.map((bar) => (
            <li key={bar.key}>
              <Link className={styles.macroBarLink} to="/patrimonio">
                <span className={styles.macroBarLabel}>
                  <strong>{bar.label}</strong>
                  <span className={styles.moneyValue}>{formatMoney(bar.amount)}</span>
                </span>
                <span className={styles.progress} aria-hidden>
                  <span
                    className={`${styles.progressFill} ${
                      bar.key === 'assets' ? styles.progressFill_ok : styles.progressFill_danger
                    }`}
                    style={{ width: `${bar.pct}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !insight ? <p className={styles.muted}>Cadastre ativos e passivos para ver o gráfico.</p> : null}
    </section>
  )
}

function ProjectsHomeTile({ projects, loading }: { projects: LifeProject[]; loading: boolean }) {
  return (
    <div className={`${styles.homeBlock} ${styles.homeBlockProjects}`}>
      <Link className={styles.homeBlockProjectsHead} to="/projetos">
        <Icon name="goal" size={24} />
        <strong>Projetos de vida</strong>
      </Link>
      {loading ? <Skeleton height={72} /> : null}
      <div className={styles.homeHorizonList}>
        {LIFE_HORIZONS.map((horizon) => {
          const items = projects.filter((project) => project.horizon === horizon.key)
          const goal = items.reduce((sum, project) => sum + project.goalAmount, 0)
          const accumulated = items.reduce((sum, project) => sum + project.accumulatedAmount, 0)
          const percent = goal <= 0 ? 0 : Math.min(100, (accumulated / goal) * 100)
          return (
            <Link
              key={horizon.key}
              className={styles.homeHorizonRow}
              to={`/projetos?horizonte=${horizon.key}`}
            >
              <span className={styles.homeHorizonMeta}>
                <strong>{horizon.label.replace(' prazo', '')}</strong>
                <span>{formatPercent(percent)}</span>
              </span>
              <span className={styles.progress} aria-hidden>
                <span
                  className={`${styles.progressFill} ${horizonFillClass(styles, horizon.key)}`}
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className={`${styles.homeHorizonAmounts} ${styles.moneyValue}`}>
                {formatMoney(accumulated)}
                {goal > 0 ? ` / ${formatMoney(goal)}` : ''}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
