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
import { ErrorText, Skeleton } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { currentCompetence, formatMoney, formatPercent } from '../lib/format'
import {
  buildBudgetMacroBars,
  buildExpensePieSlices,
  buildIncomeExpenseCompare,
  buildIncomePieSlices,
  buildRaioXHomeInsight,
  pieConicGradient,
  type CompareBar,
  type PieSlice,
} from '../lib/homeInsights'
import { horizonFillClass, LIFE_HORIZONS } from '../lib/lifeHorizon'
import { patrimonyRootAmounts } from '../lib/raioX'
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
          <HomeRealizedCharts budget={budget.data} loading={budget.loading && !budget.data} />

          <section className={styles.macroGrid} aria-label="Visão macro">
            <BudgetMacroChart budget={budget.data} loading={budget.loading && !budget.data} />
            <PatrimonyMacroChart summary={patrimony.data} loading={patrimony.loading && !patrimony.data} />
          </section>

          <nav className={styles.homeBlocks} aria-label="Atalhos principais">
            <ProjectsHomeTile projects={projects.data ?? []} loading={projects.loading && !projects.data} />
          </nav>
        </>
      ) : null}
    </div>
  )
}

function HomeRealizedCharts({ budget, loading }: { budget: Budget | null | undefined; loading: boolean }) {
  const incomeSlices = useMemo(() => (budget ? buildIncomePieSlices(budget) : []), [budget])
  const expenseSlices = useMemo(() => (budget ? buildExpensePieSlices(budget) : []), [budget])
  const compare = useMemo(() => (budget ? buildIncomeExpenseCompare(budget) : []), [budget])

  return (
    <section className={styles.homeCharts} aria-label="Receita e despesa do mês">
      <div className={styles.homePieGrid}>
        <PieCard title="Receita" slices={incomeSlices} loading={loading} empty="Sem receita neste mês." />
        <PieCard title="Despesa" slices={expenseSlices} loading={loading} empty="Sem despesa neste mês." />
      </div>
      <CompareCard bars={compare} loading={loading} />
    </section>
  )
}

function PieCard({
  title,
  slices,
  loading,
  empty,
}: {
  title: string
  slices: PieSlice[]
  loading: boolean
  empty: string
}) {
  return (
    <section className={styles.macroCard} aria-label={title}>
      <div className={styles.macroHead}>
        <strong>{title}</strong>
      </div>
      {loading ? <Skeleton height={160} /> : null}
      {!loading && slices.length === 0 ? <p className={styles.muted}>{empty}</p> : null}
      {!loading && slices.length > 0 ? (
        <div className={styles.pieLayout}>
          <div
            className={styles.pieChart}
            style={{ background: pieConicGradient(slices) }}
            role="img"
            aria-label={`${title}: ${slices.map((slice) => `${slice.label} ${formatPercent(slice.pct)}`).join(', ')}`}
          />
          <ul className={styles.pieLegend}>
            {slices.map((slice) => (
              <li key={slice.key}>
                <Link
                  className={styles.pieLegendLink}
                  to={
                    slice.categoryId
                      ? `/raio-x?conta=${encodeURIComponent(slice.categoryId)}`
                      : slice.section
                        ? `/raio-x?section=${encodeURIComponent(slice.section)}`
                        : '/raio-x'
                  }
                >
                  <span className={styles.pieSwatch} style={{ background: slice.color }} aria-hidden />
                  <span>
                    <strong>{slice.label}</strong>
                    <span className={styles.moneyValue}>{formatMoney(slice.amount)}</span>
                  </span>
                  <span>{formatPercent(slice.pct)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function CompareCard({ bars, loading }: { bars: CompareBar[]; loading: boolean }) {
  return (
    <section className={styles.macroCard} aria-label="Receita versus despesa">
      <div className={styles.macroHead}>
        <strong>Receita × despesa</strong>
        <span className={styles.macroHeadMeta}>Receita: % do orçado · Despesa: % da renda gastável</span>
      </div>
      {loading ? <Skeleton height={96} /> : null}
      {!loading && bars.length === 0 ? (
        <p className={styles.muted}>Sem orçamento ou movimento neste mês.</p>
      ) : null}
      {!loading && bars.length > 0 ? (
        <ul className={styles.macroBars}>
          {bars.map((bar) => (
            <li key={bar.key}>
              <Link
                className={styles.macroBarLink}
                to={
                  bar.section === 'Expense'
                    ? '/raio-x?section=Expense'
                    : `/raio-x?section=${encodeURIComponent(bar.section)}`
                }
              >
                <span className={styles.macroBarLabel}>
                  <strong>{bar.label}</strong>
                  <span>
                    {bar.planned <= 0
                      ? bar.actual > 0
                        ? bar.key === 'expense'
                          ? 'Sem renda gastável'
                          : 'Sem orçamento'
                        : '—'
                      : formatPercent((bar.actual / bar.planned) * 100)}
                  </span>
                </span>
                <span className={styles.progress} aria-hidden>
                  <span
                    className={`${styles.progressFill} ${
                      bar.tone === 'over'
                        ? styles.progressFill_danger
                        : bar.tone === 'muted' || bar.tone === 'unbudgeted'
                          ? styles.progressFillMuted
                          : bar.key === 'income'
                            ? styles.progressFill_ok
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
                        : bar.tone === 'muted' || bar.tone === 'unbudgeted'
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
  const amounts = summary ? patrimonyRootAmounts(summary) : null

  return (
    <section className={styles.macroCard} aria-label="Patrimônio">
      <div className={styles.macroHead}>
        <Link className={styles.homeBlockProjectsHead} to="/patrimonio">
          <Icon name="wallet" size={24} />
          <strong>Patrimônio</strong>
        </Link>
      </div>
      {loading ? <Skeleton height={96} /> : null}
      {!loading && amounts ? (
        <div className={styles.heroCards}>
          <Link className={styles.heroCard} to="/patrimonio">
            <span>Ativo</span>
            <strong className={`${styles.moneyValue} ${styles.positive}`}>{formatMoney(amounts.assets)}</strong>
          </Link>
          <Link className={styles.heroCard} to="/patrimonio">
            <span>Passivo</span>
            <strong className={`${styles.moneyValue} ${styles.negative}`}>
              {formatMoney(amounts.liabilities)}
            </strong>
          </Link>
          <Link
            className={`${styles.heroCard} ${styles.heroCardPatrimonyActive}`}
            to="/patrimonio"
          >
            <span>Patrimônio líquido</span>
            <strong className={`${styles.moneyValue} ${amounts.netWorth < 0 ? styles.negative : ''}`}>
              {formatMoney(amounts.netWorth)}
            </strong>
            <span className={styles.muted}>Ativo − passivo</span>
          </Link>
        </div>
      ) : null}
      {!loading && !amounts ? <p className={styles.muted}>Cadastre ativos e passivos para ver o patrimônio.</p> : null}
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
