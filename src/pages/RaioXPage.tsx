import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  budgetsApi,
  categoriesApi,
  entriesApi,
  patrimonyApi,
  projectsApi,
  type Budget,
  type BudgetYear,
  type Category,
  type CategorySection,
  type Entry,
  type LifeProject,
  type PatrimonyItem,
  type PatrimonySummary,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { ProgressToneLegend } from '../components/ProgressToneLegend'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { categoryLabel } from '../lib/categoryLabel'
import { compareCategorySiblings, isCashFlowSection, isPatrimonySection } from '../lib/categoryOrder'
import { buildBudgetMacroBars } from '../lib/homeInsights'
import { currentCompetence, formatCompetence, formatMoney, formatPercent } from '../lib/format'
import {
  aggregateYearMonths,
  buildAmountMaps,
  focusSections,
  groupAccountsByParent,
  monthsEndingAt,
  patrimonyRootAmounts,
  patrimonyStockMap,
  progressPercent,
  progressTone,
  sectionHead,
  sectionRealized,
  sumBranch,
  yearsNeededForMonths,
  type ProgressTone,
  type RaioXFocus,
  type RaioXTotals,
} from '../lib/raioX'
import styles from './page.module.css'

const PERIODS = [1, 2, 6, 12] as const

function focusClass(section: CategorySection, highlighted: CategorySection[]): string {
  if (!highlighted.includes(section)) {
    return ''
  }
  if (section === 'Discount') {
    return styles.raioxFocusDiscount
  }
  if (section === 'Asset' || section === 'Liability' || section === 'Patrimony') {
    return section === 'Liability' ? styles.raioxFocusLiability : styles.raioxFocusAsset
  }
  if (section === 'Income') {
    return styles.raioxFocusIncome
  }
  return styles.raioxFocus
}

function toneClass(tone: ProgressTone): string {
  if (tone === 'over') {
    return styles.raioxToneOver
  }
  if (tone === 'unbudgeted') {
    return styles.raioxToneUnbudgeted
  }
  if (tone === 'muted') {
    return styles.raioxToneMuted
  }
  return styles.raioxToneOk
}

function TotalsCell({ totals, stock = false }: { totals: RaioXTotals; stock?: boolean }) {
  if (stock) {
    const has = Math.abs(totals.actual) > 0.001
    return (
      <span className={styles.raioxTotals}>
        <span className={styles.raioxAmount}>—</span>
        <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>
          {has ? formatMoney(totals.actual) : '—'}
        </span>
        <span className={styles.raioxPercent}>—</span>
      </span>
    )
  }

  const percent = progressPercent(totals)
  const tone = progressTone(percent, totals)
  const shown = percent === null ? 0 : percent
  return (
    <span className={styles.raioxTotals}>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.planned)}</span>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.actual)}</span>
      <span className={`${styles.raioxPercent} ${toneClass(tone)}`}>{formatPercent(shown)}</span>
    </span>
  )
}

function parseSectionParam(raw: string | null): CategorySection | null {
  if (!raw) {
    return null
  }
  if (
    isCashFlowSection(raw as CategorySection) ||
    raw === 'Asset' ||
    raw === 'Liability' ||
    raw === 'Expense' ||
    raw === 'Budget' ||
    raw === 'Patrimony'
  ) {
    return raw as CategorySection
  }
  return null
}

function isStockSection(section: CategorySection): boolean {
  return section === 'Patrimony' || isPatrimonySection(section)
}

function ancestorIds(accountId: string, list: Category[]): string[] {
  const byId = new Map(list.map((account) => [account.id, account]))
  const path: string[] = []
  let current = byId.get(accountId)
  while (current?.parentId) {
    path.push(current.parentId)
    current = byId.get(current.parentId)
  }
  return path
}

export function RaioXPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusSection = parseSectionParam(searchParams.get('section'))
  const [ym, setYm] = useState(currentCompetence)
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(1)
  const [focus, setFocus] = useState<RaioXFocus>(null)
  const [open, setOpen] = useState<Set<string>>(() => new Set())

  const monthList = useMemo(() => monthsEndingAt(ym, months), [ym, months])
  const yearNums = useMemo(() => yearsNeededForMonths(monthList), [monthList])

  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const yearA = useLoad(() => budgetsApi.getYear(yearNums[0]!), [yearNums[0]])
  const yearB = useLoad(
    () => (yearNums[1] != null ? budgetsApi.getYear(yearNums[1]) : Promise.resolve(null)),
    [yearNums[1]],
  )
  const accounts = useLoad(() => categoriesApi.list(undefined, false, false), [])
  const patrimony = useLoad(() => patrimonyApi.get(), [])
  const projects = useLoad(() => projectsApi.list(), [])
  const entries = useLoad(
    () =>
      months === 1
        ? entriesApi.list({ competenceYm: ym, take: 200 })
        : Promise.resolve({ items: [], skip: 0, take: 0, totalCount: 0 }),
    [ym, months],
  )

  const list = accounts.data ?? []
  const byParent = useMemo(() => {
    const map = groupAccountsByParent(list)
    for (const bucket of map.values()) {
      bucket.sort(compareCategorySiblings)
    }
    return map
  }, [list])

  const patAmounts = useMemo(
    () => patrimonyStockMap(patrimony.data?.items ?? []),
    [patrimony.data],
  )
  const emptyAmounts = useMemo(() => new Map<string, number>(), [])

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

  const incomeHead = useMemo(() => sectionHead(list, 'Income'), [list])
  const expenseHead = useMemo(
    () =>
      list.find(
        (account) =>
          account.code === 'EXPENSE' || (account.section === 'Expense' && account.level !== 'Analytical'),
      ),
    [list],
  )
  const patrimonyHead = useMemo(
    () =>
      list.find(
        (account) =>
          account.code === 'PATRIMONY' ||
          (account.section === 'Patrimony' && account.level === 'Root'),
      ),
    [list],
  )

  const rootRows = useMemo(
    () => [incomeHead, expenseHead, patrimonyHead].filter(Boolean) as Category[],
    [incomeHead, expenseHead, patrimonyHead],
  )

  const entriesByAccount = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const entry of entries.data?.items ?? []) {
      if (!entry.categoryId) {
        continue
      }
      if (entry.type === 'ProjectContribution' || entry.type === 'Contribution') {
        continue
      }
      const bucket = map.get(entry.categoryId) ?? []
      bucket.push(entry)
      map.set(entry.categoryId, bucket)
    }
    return map
  }, [entries.data])

  const patItemsByAccount = useMemo(() => {
    const map = new Map<string, PatrimonyItem[]>()
    for (const item of patrimony.data?.items ?? []) {
      const bucket = map.get(item.categoryId) ?? []
      bucket.push(item)
      map.set(item.categoryId, bucket)
    }
    return map
  }, [patrimony.data])

  const projectsByAccount = useMemo(() => {
    const map = new Map<string, LifeProject[]>()
    for (const project of projects.data ?? []) {
      if (!project.categoryId) {
        continue
      }
      const bucket = map.get(project.categoryId) ?? []
      bucket.push(project)
      map.set(project.categoryId, bucket)
    }
    return map
  }, [projects.data])

  useEffect(() => {
    if (!focusSection || list.length === 0) {
      return
    }
    const head =
      focusSection === 'Expense'
        ? expenseHead
        : focusSection === 'Patrimony' || focusSection === 'Asset' || focusSection === 'Liability'
          ? focusSection === 'Patrimony'
            ? patrimonyHead
            : sectionHead(list, focusSection)
          : focusSection === 'Budget'
            ? list.find((account) => account.code === 'BUDGET')
            : sectionHead(list, focusSection)
    if (!head) {
      return
    }
    setOpen((current) => {
      const next = new Set(current)
      next.add(head.id)
      for (const id of ancestorIds(head.id, list)) {
        if (rootRows.some((root) => root.id === id) || list.some((account) => account.id === id)) {
          next.add(id)
        }
      }
      // Keep path from root so the head is visible under Receita/Despesa/Patrimônio.
      for (const root of rootRows) {
        if (root.id === head.id || ancestorIds(head.id, list).includes(root.id)) {
          next.add(root.id)
        }
      }
      return next
    })
    const next = new URLSearchParams(searchParams)
    next.delete('section')
    next.delete('conta')
    setSearchParams(next, { replace: true })
  }, [focusSection, list, expenseHead, patrimonyHead, rootRows, searchParams, setSearchParams])

  function toggle(id: string) {
    setFocus(null)
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

  function clearFocus() {
    setFocus(null)
  }

  function openEntry(entry: Entry) {
    if (entry.type === 'ProjectContribution' || entry.type === 'Contribution') {
      const params = new URLSearchParams()
      if (entry.description) {
        params.set('search', entry.description)
      }
      navigate(params.size > 0 ? `/projetos?${params.toString()}` : '/projetos')
      return
    }
    const params = new URLSearchParams({
      competenceYm: entry.competenceYm || ym,
      search: entry.description || '',
    })
    navigate(`/lancamentos?${params.toString()}`)
  }

  function openPatItem(item: PatrimonyItem) {
    const params = new URLSearchParams({ search: item.name })
    navigate(`/patrimonio?${params.toString()}`)
  }

  function openProject(project: LifeProject) {
    const params = new URLSearchParams({ search: project.name })
    navigate(`/projetos?${params.toString()}`)
  }

  const data = budget.data
  const highlighted = focusSections(focus)
  const loadingRange = months > 1 && ((yearA.loading && !yearA.data) || (yearNums[1] != null && yearB.loading && !yearB.data))
  const lifeActual = sectionRealized(byParent, actual, 'LifeProject', list)

  return (
    <div className={styles.page} onClick={clearFocus}>
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
        message={
          budget.error ??
          accounts.error ??
          patrimony.error ??
          projects.error ??
          entries.error ??
          yearA.error ??
          yearB.error
        }
      />
      {(budget.loading && !data) || loadingRange ? <Loading /> : null}
      {data ? (
        <RaioXHero
          incomeActual={sectionRealized(byParent, actual, 'Income', list)}
          discountActual={sectionRealized(byParent, actual, 'Discount', list)}
          lifeActual={lifeActual}
          focus={focus}
          onFocus={toggleFocus}
          months={months}
          ym={ym}
        />
      ) : null}
      {data ? (
        <RaioXSideCards
          budget={data}
          patrimony={patrimony.data}
          focus={focus}
          onFocus={toggleFocus}
          onExpandSection={(section) => {
            setFocus(null)
            const head =
              section === 'Expense'
                ? expenseHead
                : section === 'Patrimony' || section === 'Asset' || section === 'Liability'
                  ? section === 'Patrimony'
                    ? patrimonyHead
                    : sectionHead(list, section)
                  : sectionHead(list, section)
            if (!head) {
              return
            }
            setOpen((current) => {
              const next = new Set(current)
              next.add(head.id)
              for (const root of rootRows) {
                if (root.id === head.id || ancestorIds(head.id, list).includes(root.id)) {
                  next.add(root.id)
                }
              }
              return next
            })
          }}
        />
      ) : null}
      {accounts.loading && !accounts.data ? <Loading /> : null}
      {rootRows.length > 0 ? (
        <div className={styles.raioxList}>
          <ProgressToneLegend />
          <div className={`${styles.raioxRow} ${styles.raioxHead}`}>
            <span />
            <span>Categoria</span>
            <span className={styles.raioxTotals}>
              <span>Previsto</span>
              <span>Realizado</span>
              <span aria-hidden="true" />
            </span>
          </div>
          {rootRows.map((account) => (
            <RaioXAccountBlock
              key={account.id}
              account={account}
              depth={0}
              byParent={byParent}
              planned={planned}
              actual={actual}
              patAmounts={patAmounts}
              emptyAmounts={emptyAmounts}
              open={open}
              highlighted={highlighted}
              entriesByAccount={entriesByAccount}
              patItemsByAccount={patItemsByAccount}
              projectsByAccount={projectsByAccount}
              onToggle={toggle}
              onOpenEntry={openEntry}
              onOpenPatItem={openPatItem}
              onOpenProject={openProject}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RaioXAccountBlock({
  account,
  depth,
  byParent,
  planned,
  actual,
  patAmounts,
  emptyAmounts,
  open,
  highlighted,
  entriesByAccount,
  patItemsByAccount,
  projectsByAccount,
  onToggle,
  onOpenEntry,
  onOpenPatItem,
  onOpenProject,
}: {
  account: Category
  depth: number
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  actual: Map<string, number>
  patAmounts: Map<string, number>
  emptyAmounts: Map<string, number>
  open: Set<string>
  highlighted: CategorySection[]
  entriesByAccount: Map<string, Entry[]>
  patItemsByAccount: Map<string, PatrimonyItem[]>
  projectsByAccount: Map<string, LifeProject[]>
  onToggle: (id: string) => void
  onOpenEntry: (entry: Entry) => void
  onOpenPatItem: (item: PatrimonyItem) => void
  onOpenProject: (project: LifeProject) => void
}) {
  const children = byParent.get(account.id) ?? []
  const stock = isStockSection(account.section)
  const launchEntries =
    account.level === 'Analytical' && !stock && account.section !== 'LifeProject'
      ? (entriesByAccount.get(account.id) ?? [])
      : []
  const launchPatItems =
    account.level === 'Analytical' && isPatrimonySection(account.section)
      ? (patItemsByAccount.get(account.id) ?? [])
      : []
  const launchProjects =
    account.level === 'Analytical' && account.section === 'LifeProject'
      ? (projectsByAccount.get(account.id) ?? [])
      : []
  const hasLaunches = launchEntries.length > 0 || launchPatItems.length > 0 || launchProjects.length > 0
  const expandable = children.length > 0 || hasLaunches
  const expanded = open.has(account.id)
  const totals = stock
    ? sumBranch(account.id, byParent, emptyAmounts, patAmounts)
    : sumBranch(account.id, byParent, planned, actual)
  const focused = focusClass(account.section, highlighted)
  const rowClass =
    account.level === 'Root' ||
    account.section === 'Expense' ||
    account.section === 'Income' ||
    account.section === 'Patrimony'
      ? styles.raioxRoot
      : account.level === 'Group'
        ? styles.raioxGroup
        : styles.raioxLeaf

  return (
    <>
      <button
        type="button"
        className={`${styles.raioxRow} ${rowClass} ${focused}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
        onClick={() => (expandable ? onToggle(account.id) : undefined)}
        aria-expanded={expandable ? expanded : undefined}
      >
        <span className={styles.raioxToggle} aria-hidden>
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>{categoryLabel(account)}</strong>
        <TotalsCell totals={totals} stock={stock} />
      </button>
      {expanded
        ? children.map((child) => (
            <RaioXAccountBlock
              key={child.id}
              account={child}
              depth={depth + 1}
              byParent={byParent}
              planned={planned}
              actual={actual}
              patAmounts={patAmounts}
              emptyAmounts={emptyAmounts}
              open={open}
              highlighted={highlighted}
              entriesByAccount={entriesByAccount}
              patItemsByAccount={patItemsByAccount}
              projectsByAccount={projectsByAccount}
              onToggle={onToggle}
              onOpenEntry={onOpenEntry}
              onOpenPatItem={onOpenPatItem}
              onOpenProject={onOpenProject}
            />
          ))
        : null}
      {expanded
        ? launchEntries.map((entry) => (
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
      {expanded
        ? launchPatItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.raioxRow} ${styles.raioxEntry}`}
              style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
              onClick={() => onOpenPatItem(item)}
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
      {expanded
        ? launchProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`${styles.raioxRow} ${styles.raioxEntry}`}
              style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
              onClick={() => onOpenProject(project)}
            >
              <span />
              <span className={styles.rowMain}>
                <strong>{project.name}</strong>
                <span className={styles.rowSub}>Projeto de vida</span>
              </span>
              <span className={styles.raioxTotals}>
                <span className={styles.raioxAmount} />
                <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>
                  {formatMoney(project.accumulatedAmount)}
                </span>
                <span className={styles.raioxPercent} />
              </span>
            </button>
          ))
        : null}
      {expanded && account.level === 'Analytical' && children.length === 0 && !hasLaunches ? (
        <div
          className={`${styles.raioxRow} ${styles.raioxEntry}`}
          style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
        >
          <span />
          <span className={styles.muted}>
            {isPatrimonySection(account.section)
              ? 'Nenhum item de patrimônio nesta conta.'
              : account.section === 'LifeProject'
                ? 'Nenhum projeto nesta conta.'
                : 'Nenhum lançamento nesta conta.'}
          </span>
          <span />
        </div>
      ) : null}
    </>
  )
}

function RaioXHero({
  incomeActual,
  discountActual,
  lifeActual,
  focus,
  onFocus,
  months,
  ym,
}: {
  incomeActual: number
  discountActual: number
  lifeActual: number
  focus: RaioXFocus
  onFocus: (next: RaioXFocus) => void
  months: number
  ym: string
}) {
  const gastavel = incomeActual - discountActual
  const periodLabel = months === 1 ? formatCompetence(ym) : `${months} meses até ${formatCompetence(ym)}`

  return (
    <section className={styles.hero} onClick={(event) => event.stopPropagation()}>
      <div className={styles.heroTop}>
        <span>Raio-X · {periodLabel}</span>
      </div>
      <div className={styles.heroCards} aria-label="Indicadores do Raio-X">
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'income' ? styles.heroCardIncomeActive : ''}`}
          aria-pressed={focus === 'income'}
          onClick={() => onFocus('income')}
        >
          <span>Receita recebida</span>
          <strong className={styles.moneyValue}>{formatMoney(incomeActual)}</strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'discount' ? styles.heroCardDiscountActive : ''}`}
          aria-pressed={focus === 'discount'}
          onClick={() => onFocus('discount')}
        >
          <span>Descontos realizados</span>
          <strong className={styles.moneyValue}>{formatMoney(discountActual)}</strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'spendable' ? styles.heroCardSpendableActive : ''}`}
          aria-pressed={focus === 'spendable'}
          onClick={() => onFocus('spendable')}
        >
          <span>Renda gastável</span>
          <strong className={`${styles.moneyValue} ${gastavel < 0 ? styles.negative : ''}`}>
            {formatMoney(gastavel)}
          </strong>
          <span className={styles.muted}>Receita recebida − descontos realizados</span>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'life' ? styles.heroCardPatrimonyActive : ''}`}
          aria-pressed={focus === 'life'}
          onClick={() => onFocus('life')}
        >
          <span>Projeto de vida</span>
          <strong className={styles.moneyValue}>{formatMoney(lifeActual)}</strong>
          <span className={styles.muted}>
            {months === 1 ? 'Separado neste mês' : `Separado em ${months} meses`}
          </span>
        </button>
      </div>
    </section>
  )
}

function RaioXSideCards({
  budget,
  patrimony,
  focus,
  onFocus,
  onExpandSection,
}: {
  budget: Budget
  patrimony: PatrimonySummary | null | undefined
  focus: RaioXFocus
  onFocus: (next: RaioXFocus) => void
  onExpandSection: (section: CategorySection) => void
}) {
  const bars = buildBudgetMacroBars(budget)
  const amounts = patrimony ? patrimonyRootAmounts(patrimony) : null

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
                <button
                  type="button"
                  className={styles.macroBarLink}
                  onClick={() => onExpandSection(bar.section)}
                >
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
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {amounts ? (
        <section
          className={styles.macroCard}
          aria-label="Patrimônio"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.macroHead}>
            <strong>Patrimônio</strong>
          </div>
          <div className={styles.heroCards}>
            <button
              type="button"
              className={`${styles.heroCard} ${focus === 'patrimony' ? styles.heroCardPatrimonyActive : ''}`}
              aria-pressed={focus === 'patrimony'}
              onClick={() => onFocus('patrimony')}
            >
              <span>Ativo</span>
              <strong className={`${styles.moneyValue} ${styles.positive}`}>{formatMoney(amounts.assets)}</strong>
            </button>
            <button
              type="button"
              className={`${styles.heroCard} ${focus === 'patrimony' ? styles.heroCardPatrimonyActive : ''}`}
              aria-pressed={focus === 'patrimony'}
              onClick={() => onFocus('patrimony')}
            >
              <span>Passivo</span>
              <strong className={`${styles.moneyValue} ${styles.negative}`}>
                {formatMoney(amounts.liabilities)}
              </strong>
            </button>
            <button
              type="button"
              className={`${styles.heroCard} ${focus === 'patrimony' ? styles.heroCardPatrimonyActive : ''}`}
              aria-pressed={focus === 'patrimony'}
              onClick={() => onFocus('patrimony')}
            >
              <span>Patrimônio líquido</span>
              <strong className={`${styles.moneyValue} ${amounts.netWorth < 0 ? styles.negative : ''}`}>
                {formatMoney(amounts.netWorth)}
              </strong>
              <span className={styles.muted}>Ativo − passivo</span>
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
