import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  budgetsApi,
  chartAccountsApi,
  entriesApi,
  patrimonyApi,
  type Budget,
  type BudgetYear,
  type ChartAccount,
  type ChartSection,
  type Entry,
  type PatrimonyItem,
  type PatrimonySummary,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { chartAccountLabel } from '../lib/chartLabel'
import { compareChartSiblings, isCashFlowSection } from '../lib/chartOrder'
import { buildBudgetMacroBars, buildPatrimonyMacroBars } from '../lib/homeInsights'
import { currentCompetence, formatCompetence, formatMoney, formatPercent } from '../lib/format'
import {
  aggregateYearMonths,
  buildAmountMaps,
  discountTotals,
  focusSections,
  groupAccountsByParent,
  incomePlanned,
  monthsEndingAt,
  patrimonyRootAmounts,
  progressPercent,
  progressTone,
  spendableIncomeBox,
  sumBranch,
  yearsNeededForMonths,
  type ProgressTone,
  type RaioXFocus,
  type RaioXTotals,
} from '../lib/raioX'
import styles from './page.module.css'

const PERIODS = [1, 2, 6, 12] as const

function toneClass(tone: ProgressTone): string {
  if (tone === 'over') {
    return styles.raioxToneOver
  }
  if (tone === 'muted') {
    return styles.raioxToneMuted
  }
  return styles.raioxToneOk
}

function TotalsCell({ totals }: { totals: RaioXTotals }) {
  const percent = progressPercent(totals)
  const tone = progressTone(percent, totals)
  return (
    <span className={styles.raioxTotals}>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.planned)}</span>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.actual)}</span>
      <span className={`${styles.raioxPercent} ${toneClass(tone)}`}>
        {percent === null ? '—' : formatPercent(percent)}
      </span>
    </span>
  )
}

function parseSectionParam(raw: string | null): ChartSection | null {
  if (!raw) {
    return null
  }
  return isCashFlowSection(raw as ChartSection) || raw === 'Asset' || raw === 'Liability'
    ? (raw as ChartSection)
    : null
}

export function RaioXPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusSection = parseSectionParam(searchParams.get('section'))
  const [ym, setYm] = useState(currentCompetence)
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(1)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [focus, setFocus] = useState<RaioXFocus>(null)

  const monthList = useMemo(() => monthsEndingAt(ym, months), [ym, months])
  const yearNums = useMemo(() => yearsNeededForMonths(monthList), [monthList])

  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const yearA = useLoad(() => budgetsApi.getYear(yearNums[0]!), [yearNums[0]])
  const yearB = useLoad(
    () => (yearNums[1] != null ? budgetsApi.getYear(yearNums[1]) : Promise.resolve(null)),
    [yearNums[1]],
  )
  const accounts = useLoad(() => chartAccountsApi.list(undefined, false, false), [])
  const entries = useLoad(
    () => (months === 1 ? entriesApi.list({ competenceYm: ym, take: 200 }) : Promise.resolve({ items: [], skip: 0, take: 0, totalCount: 0 })),
    [ym, months],
  )
  const patrimony = useLoad(() => patrimonyApi.get(), [])

  const list = accounts.data ?? []
  const byParent = useMemo(() => {
    const map = groupAccountsByParent(list)
    for (const bucket of map.values()) {
      bucket.sort(compareChartSiblings)
    }
    return map
  }, [list])

  const { planned, actual } = useMemo(() => {
    if (months === 1) {
      return buildAmountMaps(budget.data?.lines ?? [])
    }
    const years: BudgetYear[] = []
    if (yearA.data) {
      years.push(yearA.data)
    }
    if (yearB.data) {
      years.push(yearB.data)
    }
    return aggregateYearMonths(years, monthList)
  }, [months, budget.data, yearA.data, yearB.data, monthList])

  const roots = useMemo(() => {
    const all = (byParent.get(null) ?? []).filter((account) => account.level === 'Root')
    const cash = all.filter((account) => isCashFlowSection(account.section))
    const pat = all.filter((account) => account.section === 'Asset' || account.section === 'Liability')
    return [...cash, ...pat]
  }, [byParent])

  useEffect(() => {
    if (!focusSection || roots.length === 0) {
      return
    }
    const match = roots.find((root) => root.section === focusSection)
    if (match) {
      setOpen((current) => new Set(current).add(match.id))
    }
  }, [focusSection, roots])

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleFocus(next: RaioXFocus) {
    setFocus((current) => (current === next ? null : next))
  }

  function entriesFor(accountId: string): Entry[] {
    if (months !== 1) {
      return []
    }
    return (entries.data?.items ?? []).filter((entry) => entry.chartAccountId === accountId)
  }

  function patrimonyItemsFor(accountId: string): PatrimonyItem[] {
    return (patrimony.data?.items ?? []).filter((item) => item.chartAccountId === accountId)
  }

  function openOrigin(account: ChartAccount, entry?: Entry) {
    if (account.section === 'Asset' || account.section === 'Liability') {
      const params = new URLSearchParams()
      params.set('chartAccountId', account.id)
      navigate(`/patrimonio?${params.toString()}`)
      return
    }
    if (account.section === 'LifeProject') {
      navigate('/projetos')
      return
    }
    const params = new URLSearchParams({ competenceYm: ym })
    if (entry?.chartAccountId || account.level === 'Analytical') {
      params.set('chartAccountId', entry?.chartAccountId ?? account.id)
    }
    navigate(`/lancamentos?${params.toString()}`)
  }

  function openEntry(entry: Entry) {
    const params = new URLSearchParams({ competenceYm: ym })
    if (entry.chartAccountId) {
      params.set('chartAccountId', entry.chartAccountId)
    }
    if (entry.type === 'ProjectContribution' || entry.type === 'Contribution') {
      navigate('/projetos')
      return
    }
    navigate(`/lancamentos?${params.toString()}`)
  }

  const data = budget.data
  const highlighted = focusSections(focus)
  const loadingRange = months > 1 && ((yearA.loading && !yearA.data) || (yearNums[1] != null && yearB.loading && !yearB.data))

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Visão"
        title="Raio-X"
        actions={
          <>
            <CompetencePicker value={ym} onChange={setYm} />
            <div className={styles.periodSeg} role="group" aria-label="Período">
              {PERIODS.map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={months === count}
                  onClick={() => setMonths(count)}
                >
                  {count === 1 ? '1 mês' : `${count} meses`}
                </button>
              ))}
            </div>
          </>
        }
      />
      <ErrorText
        message={budget.error ?? accounts.error ?? entries.error ?? patrimony.error ?? yearA.error ?? yearB.error}
      />
      {(budget.loading && !data) || loadingRange ? <Loading /> : null}
      {data ? (
        <RaioXHero
          budget={data}
          patrimony={patrimony.data}
          focus={focus}
          onFocus={toggleFocus}
          months={months}
          ym={ym}
        />
      ) : null}
      {data ? <RaioXCharts budget={data} patrimony={patrimony.data} /> : null}
      {accounts.loading && !accounts.data ? <Loading /> : null}
      {roots.length > 0 ? (
        <div className={styles.raioxList}>
          <div className={`${styles.raioxRow} ${styles.raioxHead}`}>
            <span />
            <span>Conta</span>
            <span className={styles.raioxTotals}>
              <span>Previsto</span>
              <span>Realizado</span>
              <span>% do previsto</span>
            </span>
          </div>
          {roots.map((root) => (
            <AccountBlock
              key={root.id}
              account={root}
              depth={0}
              byParent={byParent}
              planned={planned}
              actual={actual}
              open={open}
              onToggle={toggle}
              entriesFor={entriesFor}
              patrimonyItemsFor={patrimonyItemsFor}
              onOpenEntry={openEntry}
              onOpenOrigin={openOrigin}
              highlighted={highlighted}
              patrimony={patrimony.data}
              showEntries={months === 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RaioXHero({
  budget,
  patrimony,
  focus,
  onFocus,
  months,
  ym,
}: {
  budget: Budget
  patrimony: PatrimonySummary | null | undefined
  focus: RaioXFocus
  onFocus: (next: RaioXFocus) => void
  months: number
  ym: string
}) {
  const receitaPrevista = incomePlanned(budget)
  const receitaRecebida = Math.abs(budget.receivedIncome)
  const desconto = discountTotals(budget)
  const gastavel = spendableIncomeBox(budget)
  const liquido = patrimony ? patrimonyRootAmounts(patrimony).netWorth : 0
  const periodLabel =
    months === 1 ? formatCompetence(budget.competenceYm) : `${months} meses até ${formatCompetence(ym)}`

  return (
    <section className={styles.hero}>
      <div className={styles.heroTop}>
        <span>Raio-X · {periodLabel}</span>
      </div>
      <div className={styles.heroCards} aria-label="Indicadores do Raio-X">
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'income' ? styles.heroCardActive : ''}`}
          onMouseEnter={() => onFocus('income')}
          onFocus={() => onFocus('income')}
          onClick={() => onFocus('income')}
        >
          <span>Receita</span>
          <strong className={styles.moneyValue}>{formatMoney(receitaRecebida || receitaPrevista)}</strong>
          <span className={styles.muted}>
            Prevista {formatMoney(receitaPrevista)} · recebida {formatMoney(receitaRecebida)}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'spendable' ? styles.heroCardActive : ''}`}
          onMouseEnter={() => onFocus('spendable')}
          onFocus={() => onFocus('spendable')}
          onClick={() => onFocus('spendable')}
        >
          <span>Renda gastável</span>
          <strong className={styles.moneyValue}>
            {formatMoney(months === 1 ? gastavel.planned : gastavel.actual || gastavel.planned)}
          </strong>
          <span className={styles.muted}>
            Previsto {formatMoney(gastavel.planned)} · realizado {formatMoney(gastavel.actual)}
            {desconto.actual > 0 ? ` · desconto ${formatMoney(desconto.actual)}` : ''}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'patrimony' ? styles.heroCardActive : ''}`}
          onMouseEnter={() => onFocus('patrimony')}
          onFocus={() => onFocus('patrimony')}
          onClick={() => onFocus('patrimony')}
        >
          <span>Patrimônio líquido</span>
          <strong className={`${styles.moneyValue} ${liquido < 0 ? styles.negative : ''}`}>
            {formatMoney(liquido)}
          </strong>
          <span className={styles.muted}>Ativo − passivo</span>
        </button>
      </div>
    </section>
  )
}

function RaioXCharts({
  budget,
  patrimony,
}: {
  budget: Budget
  patrimony: PatrimonySummary | null | undefined
}) {
  const bars = buildBudgetMacroBars(budget)
  const patBars = patrimony ? buildPatrimonyMacroBars(patrimony) : []

  return (
    <div className={styles.macroGrid}>
      <section className={styles.macroCard} aria-label="Previsto versus realizado">
        <div className={styles.macroHead}>
          <strong>Previsto × realizado</strong>
        </div>
        {bars.length === 0 ? (
          <p className={styles.muted}>Sem valores de fluxo neste mês.</p>
        ) : (
          <ul className={styles.macroBars}>
            {bars.map((bar) => (
              <li key={bar.section}>
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
              </li>
            ))}
          </ul>
        )}
      </section>
      {patBars.length > 0 ? (
        <section className={styles.macroCard} aria-label="Composição patrimonial">
          <div className={styles.macroHead}>
            <strong>Ativo e passivo</strong>
          </div>
          <ul className={styles.macroBars}>
            {patBars.map((bar) => (
              <li key={bar.key}>
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
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function AccountBlock({
  account,
  depth,
  byParent,
  planned,
  actual,
  open,
  onToggle,
  entriesFor,
  patrimonyItemsFor,
  onOpenEntry,
  onOpenOrigin,
  highlighted,
  patrimony,
  showEntries,
}: {
  account: ChartAccount
  depth: number
  byParent: Map<string | null, ChartAccount[]>
  planned: Map<string, number>
  actual: Map<string, number>
  open: Set<string>
  onToggle: (id: string) => void
  entriesFor: (accountId: string) => Entry[]
  patrimonyItemsFor: (accountId: string) => PatrimonyItem[]
  onOpenEntry: (entry: Entry) => void
  onOpenOrigin: (account: ChartAccount, entry?: Entry) => void
  highlighted: ChartSection[]
  patrimony: PatrimonySummary | null | undefined
  showEntries: boolean
}) {
  const children = byParent.get(account.id) ?? []
  const isPatSection = account.section === 'Asset' || account.section === 'Liability'
  const monthEntries = showEntries && account.level === 'Analytical' && !isPatSection ? entriesFor(account.id) : []
  const patItems = isPatSection && account.level === 'Analytical' ? patrimonyItemsFor(account.id) : []
  const expandable = children.length > 0 || monthEntries.length > 0 || patItems.length > 0
  const expanded = open.has(account.id)
  const isPatRoot = account.level === 'Root' && isPatSection
  const totals: RaioXTotals = isPatRoot && patrimony
    ? account.section === 'Asset'
      ? { planned: patrimonyRootAmounts(patrimony).assets, actual: patrimonyRootAmounts(patrimony).assets }
      : { planned: patrimonyRootAmounts(patrimony).liabilities, actual: patrimonyRootAmounts(patrimony).liabilities }
    : sumBranch(account.id, byParent, planned, actual)

  const rowClass =
    account.level === 'Root'
      ? styles.raioxRoot
      : account.level === 'Group'
        ? styles.raioxGroup
        : styles.raioxLeaf
  const focused = highlighted.includes(account.section)

  function onRowClick() {
    if (expandable) {
      onToggle(account.id)
      return
    }
    if (account.level === 'Analytical') {
      onOpenOrigin(account)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.raioxRow} ${rowClass} ${focused ? styles.raioxFocus : ''}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
        onClick={onRowClick}
        aria-expanded={expandable ? expanded : undefined}
      >
        <span className={styles.raioxToggle} aria-hidden>
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>{chartAccountLabel(account)}</strong>
        <TotalsCell
          totals={
            account.level === 'Analytical' && isPatSection
              ? {
                  planned: patItems.reduce((sum, item) => sum + Math.abs(item.amount), 0),
                  actual: patItems.reduce((sum, item) => sum + Math.abs(item.amount), 0),
                }
              : totals
          }
        />
      </button>
      {expanded
        ? children.map((child) => (
            <AccountBlock
              key={child.id}
              account={child}
              depth={depth + 1}
              byParent={byParent}
              planned={planned}
              actual={actual}
              open={open}
              onToggle={onToggle}
              entriesFor={entriesFor}
              patrimonyItemsFor={patrimonyItemsFor}
              onOpenEntry={onOpenEntry}
              onOpenOrigin={onOpenOrigin}
              highlighted={highlighted}
              patrimony={patrimony}
              showEntries={showEntries}
            />
          ))
        : null}
      {expanded && monthEntries.length > 0
        ? monthEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`${styles.raioxRow} ${styles.raioxEntry}`}
              style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
              onClick={() => onOpenEntry(entry)}
            >
              <span />
              <span className={styles.rowMain}>
                <strong>{entry.description || 'Lançamento'}</strong>
                <span className={styles.rowSub}>{entry.competenceYm}</span>
              </span>
              <span className={styles.raioxTotals}>
                <span className={styles.raioxAmount} />
                <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>
                  {formatMoney(Math.abs(entry.amount))}
                </span>
                <span className={styles.raioxPercent} />
              </span>
            </button>
          ))
        : null}
      {expanded && patItems.length > 0
        ? patItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.raioxRow} ${styles.raioxEntry}`}
              style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
              onClick={() => onOpenOrigin(account)}
            >
              <span />
              <span className={styles.rowMain}>
                <strong>{item.name}</strong>
                <span className={styles.rowSub}>{item.groupName}</span>
              </span>
              <span className={styles.raioxTotals}>
                <span className={styles.raioxAmount} />
                <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>
                  {formatMoney(Math.abs(item.amount))}
                </span>
                <span className={styles.raioxPercent} />
              </span>
            </button>
          ))
        : null}
      {expanded && children.length === 0 && monthEntries.length === 0 && patItems.length === 0 ? (
        <div
          className={`${styles.raioxRow} ${styles.raioxEntry}`}
          style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
        >
          <span />
          <span className={styles.muted}>
            {isPatSection ? 'Nenhum item de patrimônio nesta conta.' : 'Nenhum lançamento nesta conta.'}
          </span>
          <span />
        </div>
      ) : null}
    </>
  )
}
