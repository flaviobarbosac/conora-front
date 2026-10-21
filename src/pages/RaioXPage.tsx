import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  accountsApi,
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
  type SharingScope,
  entryDisplayDescription,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { SharingViewToggle } from '../components/SharingViewToggle'
import { ProgressToneLegend } from '../components/ProgressToneLegend'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { categoryLabel } from '../lib/categoryLabel'
import { compareCategorySiblings, isCashFlowSection, isPatrimonySection } from '../lib/categoryOrder'
import { buildBudgetMacroBars } from '../lib/homeInsights'
import { currentCompetence, formatCompetence, formatDate, formatMoney, formatPercent, shiftCompetence } from '../lib/format'
import {
  aggregateYearMonths,
  buildAmountMaps,
  chartWithAmounts,
  focusSections,
  groupAccountsByParent,
  idsWithAmount,
  monthsEndingAt,
  patrimonyRootAmounts,
  patrimonyStockMap,
  progressPercent,
  progressTone,
  sectionHead,
  sectionPlannedActual,
  sumBranch,
  yearsNeededForMonths,
  type ProgressTone,
  type RaioXFocus,
  type RaioXTotals,
} from '../lib/raioX'
import { readSharingView } from '../lib/sharingView'
import styles from './page.module.css'

const MONTHS_MIN = 1
const MONTHS_MAX = 24

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

/** Green when value >= 0, red when negative (saldos e resultado). */
function signedMoneyClass(value: number): string {
  return value < 0 ? styles.negative : styles.positive
}

function TotalsCell({
  totals,
  stock = false,
  onUnbudgetedClick,
}: {
  totals: RaioXTotals
  stock?: boolean
  onUnbudgetedClick?: () => void
}) {
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
  const percentClass = `${styles.raioxPercent} ${toneClass(tone)}`
  return (
    <span className={styles.raioxTotals}>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.planned)}</span>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.actual)}</span>
      {tone === 'unbudgeted' && onUnbudgetedClick ? (
        <button
          type="button"
          className={`${percentClass} ${styles.raioxPercentLink}`}
          title="Definir orçamento desta conta"
          onClick={(event) => {
            event.stopPropagation()
            onUnbudgetedClick()
          }}
        >
          {formatPercent(shown)}
        </button>
      ) : (
        <span className={percentClass}>{formatPercent(shown)}</span>
      )}
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

function sumYearField(
  years: BudgetYear[],
  monthList: string[],
  field: 'receivedIncome' | 'monthResult',
): number {
  const wanted = new Set(monthList)
  let sum = 0
  for (const year of years) {
    for (const cell of year.totals) {
      if (!wanted.has(cell.competenceYm)) {
        continue
      }
      sum += cell[field] ?? 0
    }
  }
  return sum
}

function sumYearSection(years: BudgetYear[], monthList: string[], section: CategorySection): number {
  const wanted = new Set(monthList)
  let sum = 0
  for (const year of years) {
    for (const line of year.lines) {
      if (line.section !== section) {
        continue
      }
      for (const cell of line.months) {
        if (!wanted.has(cell.competenceYm)) {
          continue
        }
        sum += Math.abs(cell.actualAmount)
      }
    }
  }
  return sum
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
  const [ym, setYm] = useState(() => searchParams.get('competenceYm') || currentCompetence())
  const [months, setMonths] = useState(() => {
    const raw = Number(searchParams.get('months'))
    return Number.isFinite(raw) && raw >= MONTHS_MIN && raw <= MONTHS_MAX ? raw : MONTHS_MIN
  })
  const [focus, setFocus] = useState<RaioXFocus>(null)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [scope, setScope] = useState<SharingScope>(readSharingView)
  const monthList = useMemo(() => monthsEndingAt(ym, months), [ym, months])
  const yearNums = useMemo(() => yearsNeededForMonths(monthList), [monthList])
  const yearKey = yearNums.join(',')

  const previousYm = useMemo(() => shiftCompetence(ym, -1), [ym])
  const budget = useLoad(() => budgetsApi.get(ym, scope), [ym, scope])
  const yearsBudget = useLoad(
    () =>
      months <= 1
        ? Promise.resolve([] as BudgetYear[])
        : Promise.all(yearNums.map((year) => budgetsApi.getYear(year, scope))),
    [months, yearKey, scope],
  )
  const previousCash = useLoad(() => accountsApi.cashBalanceAtEndOfMonth(previousYm), [previousYm])
  const accounts = useLoad(() => categoriesApi.list(undefined, true, false), [])
  const patrimony = useLoad(() => patrimonyApi.get(), [])
  const projects = useLoad(() => projectsApi.list(), [])
  const entries = useLoad(
    () =>
      months === 1
        ? entriesApi.list({ competenceYm: ym, take: 200, scope })
        : Promise.resolve({ items: [], skip: 0, take: 0, totalCount: 0 }),
    [ym, months, scope],
  )
  const bankAccounts = useLoad(() => accountsApi.list(), [])

  useEffect(() => {
    function onVoiceSaved() {
      entries.reload()
      budget.reload()
      patrimony.reload()
      projects.reload()
    }
    window.addEventListener('conora:voice-saved', onVoiceSaved)
    return () => window.removeEventListener('conora:voice-saved', onVoiceSaved)
  }, [entries.reload, budget.reload, patrimony.reload, projects.reload])

  const patAmounts = useMemo(
    () => patrimonyStockMap(patrimony.data?.items ?? []),
    [patrimony.data],
  )
  const emptyAmounts = useMemo(() => new Map<string, number>(), [])

  const { planned, actual } = useMemo(() => {
    if (months === 1) {
      return buildAmountMaps(budget.data?.lines ?? [])
    }
    return aggregateYearMonths(yearsBudget.data ?? [], monthList)
  }, [months, budget.data, yearsBudget.data, monthList])

  const list = useMemo(
    () => chartWithAmounts(accounts.data ?? [], idsWithAmount([planned, actual, patAmounts]), false),
    [accounts.data, planned, actual, patAmounts],
  )
  const byParent = useMemo(() => {
    const map = groupAccountsByParent(list)
    for (const bucket of map.values()) {
      bucket.sort(compareCategorySiblings)
    }
    return map
  }, [list])

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

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts.data ?? []) {
      map.set(account.id, categoryLabel(account))
    }
    return map
  }, [accounts.data])
  const bankNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of bankAccounts.data ?? []) {
      map.set(account.id, account.name)
    }
    return map
  }, [bankAccounts.data])

  const entriesByAccount = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const entry of entries.data?.items ?? []) {
      if (!entry.categoryId) {
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
      // Keep path from root so the head is visible under Renda/Despesa/Patrimônio.
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

  function openBudgetForAccount(accountId: string) {
    const returnParams = new URLSearchParams({ competenceYm: ym, categoryId: accountId })
    if (months > MONTHS_MIN) {
      returnParams.set('months', String(months))
    }
    const params = new URLSearchParams({
      competenceYm: ym,
      categoryId: accountId,
      returnTo: `/raio-x?${returnParams.toString()}`,
    })
    navigate(`/orcamento?${params.toString()}`)
  }

  useEffect(() => {
    const focusId = searchParams.get('categoryId')
    if (!focusId || list.length === 0) {
      return
    }
    const byId = new Map(list.map((account) => [account.id, account]))
    if (!byId.has(focusId)) {
      return
    }
    const ancestors = new Set<string>()
    let current = byId.get(focusId)
    while (current?.parentId) {
      ancestors.add(current.parentId)
      current = byId.get(current.parentId)
    }
    ancestors.add(focusId)
    setOpen((prev) => {
      const next = new Set(prev)
      for (const id of ancestors) {
        next.add(id)
      }
      return next
    })
    const timer = window.setTimeout(() => {
      document.getElementById(`raiox-account-${focusId}`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [searchParams, list])

  function openEntry(entry: Entry) {
    if (entry.canEdit === false) {
      return
    }
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
  const loadingRange = months > 1 && yearsBudget.loading && !yearsBudget.data
  const rangeIncome = sumYearField(yearsBudget.data ?? [], monthList, 'receivedIncome')
  const rangeBalance = sumYearField(yearsBudget.data ?? [], monthList, 'monthResult')
  const incomeActual = months === 1 ? Math.abs(data?.receivedIncome ?? 0) : rangeIncome
  const discountActual =
    months === 1 && data
      ? sectionPlannedActual(data, 'Discount').actual
      : sumYearSection(yearsBudget.data ?? [], monthList, 'Discount')
  const lifeActual =
    months === 1 && data
      ? sectionPlannedActual(data, 'LifeProject').actual
      : sumYearSection(yearsBudget.data ?? [], monthList, 'LifeProject')
  const monthBalance = months === 1 ? (data?.monthResult ?? 0) : rangeBalance

  return (
    <div className={styles.page} onClick={clearFocus}>
      <PageHeader
        kicker="Visão"
        title="Raio-X"
        actions={
          <>
            <SharingViewToggle onChange={setScope} />
            <CompetencePicker value={ym} onChange={setYm} />
            <label className={styles.periodSlider} onClick={(event) => event.stopPropagation()}>
              <span className={styles.periodSliderValue}>
                {months === 1 ? 'Último mês' : `Últimos ${months} meses`}
              </span>
              <span className={styles.periodSliderEnds} aria-hidden>
                {MONTHS_MIN}
              </span>
              <input
                type="range"
                min={MONTHS_MIN}
                max={MONTHS_MAX}
                step={1}
                value={months}
                aria-label="Meses a analisar"
                aria-valuemin={MONTHS_MIN}
                aria-valuemax={MONTHS_MAX}
                aria-valuenow={months}
                aria-valuetext={months === 1 ? 'Último mês' : `Últimos ${months} meses`}
                onChange={(event) => setMonths(Number(event.target.value))}
              />
              <span className={styles.periodSliderEnds} aria-hidden>
                {MONTHS_MAX}
              </span>
            </label>
          </>
        }
      />
      <ErrorText
        message={
          budget.error ??
          previousCash.error ??
          accounts.error ??
          patrimony.error ??
          projects.error ??
          entries.error ??
          yearsBudget.error
        }
      />
      {(budget.loading && !data) || loadingRange ? <Loading /> : null}
      {data ? (
        <RaioXHero
          previousMonthBalance={previousCash.data?.balance ?? 0}
          incomeActual={incomeActual}
          discountActual={discountActual}
          lifeActual={lifeActual}
          monthBalance={monthBalance}
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
              categoryNameById={categoryNameById}
              bankNameById={bankNameById}
              patItemsByAccount={patItemsByAccount}
              projectsByAccount={projectsByAccount}
              onToggle={toggle}
              onOpenEntry={openEntry}
              onOpenPatItem={openPatItem}
              onOpenProject={openProject}
              onUnbudgetedClick={openBudgetForAccount}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function EntrySubRow({
  entry,
  depth,
  categoryName,
  accountName,
  onOpen,
}: {
  entry: Entry
  depth: number
  categoryName: string | null
  accountName: string | null
  onOpen: (entry: Entry) => void
}) {
  const editable = entry.canEdit !== false
  const headline = [categoryName, accountName, formatDate(entry.occurredAt)].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      className={`${styles.raioxRow} ${styles.raioxEntry}`}
      style={{
        paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)`,
        cursor: editable ? undefined : 'default',
      }}
      aria-disabled={!editable}
      onClick={() => {
        if (editable) {
          onOpen(entry)
        }
      }}
    >
      <span />
      <span className={styles.rowMain}>
        <strong>{headline}</strong>
        <span className={styles.rowSub}>{entryDisplayDescription(entry)}</span>
      </span>
      <span className={styles.raioxTotals}>
        <span className={styles.raioxAmount} />
        <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>
          {formatMoney(Math.abs(entry.amount))}
        </span>
        <span className={styles.raioxPercent} />
      </span>
    </button>
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
  categoryNameById,
  bankNameById,
  patItemsByAccount,
  projectsByAccount,
  onToggle,
  onOpenEntry,
  onOpenPatItem,
  onOpenProject,
  onUnbudgetedClick,
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
  categoryNameById: Map<string, string>
  bankNameById: Map<string, string>
  patItemsByAccount: Map<string, PatrimonyItem[]>
  projectsByAccount: Map<string, LifeProject[]>
  onToggle: (id: string) => void
  onOpenEntry: (entry: Entry) => void
  onOpenPatItem: (item: PatrimonyItem) => void
  onOpenProject: (project: LifeProject) => void
  onUnbudgetedClick: (accountId: string) => void
}) {
  const children = byParent.get(account.id) ?? []
  const stock = isStockSection(account.section)
  const launchEntries =
    account.level === 'Analytical' ? (entriesByAccount.get(account.id) ?? []) : []
  // Patrimony stock rows stay on the category total. The item lines themselves are not listed.
  const launchPatItems: PatrimonyItem[] = patItemsByAccount.size < 0 ? (patItemsByAccount.get(account.id) ?? []) : []
  const launchProjects =
    account.level === 'Analytical' && account.section === 'LifeProject'
      ? (projectsByAccount.get(account.id) ?? [])
      : []
  const hasLaunches = launchEntries.length > 0 || launchPatItems.length > 0 || launchProjects.length > 0
  const leafActual =
    !stock && account.level === 'Analytical' && account.section !== 'LifeProject'
      ? (actual.get(account.id) ?? 0)
      : 0
  const expandable = children.length > 0 || hasLaunches || leafActual !== 0
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
        id={`raiox-account-${account.id}`}
        className={`${styles.raioxRow} ${rowClass} ${focused}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
        onClick={(event) => {
          event.stopPropagation()
          if (expandable) {
            onToggle(account.id)
          }
        }}
        aria-expanded={expandable ? expanded : undefined}
      >
        <span className={styles.raioxToggle} aria-hidden>
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>
          {categoryLabel(account)}
          {!account.isActive ? <span className={styles.rowSub}> · Inativa</span> : null}
        </strong>
        <TotalsCell
          totals={totals}
          stock={stock}
          onUnbudgetedClick={
            stock || account.section === 'LifeProject' || account.section === 'Patrimony'
              ? undefined
              : () => onUnbudgetedClick(account.id)
          }
        />
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
              categoryNameById={categoryNameById}
              bankNameById={bankNameById}
              patItemsByAccount={patItemsByAccount}
              projectsByAccount={projectsByAccount}
              onToggle={onToggle}
              onOpenEntry={onOpenEntry}
              onOpenPatItem={onOpenPatItem}
              onOpenProject={onOpenProject}
              onUnbudgetedClick={onUnbudgetedClick}
            />
          ))
        : null}
      {expanded
        ? launchEntries.map((entry) => (
            <EntrySubRow
              key={entry.id}
              entry={entry}
              depth={depth}
              categoryName={entry.categoryId ? (categoryNameById.get(entry.categoryId) ?? null) : null}
              accountName={entry.accountId ? (bankNameById.get(entry.accountId) ?? null) : null}
              onOpen={onOpenEntry}
            />
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
  previousMonthBalance,
  incomeActual,
  discountActual,
  lifeActual,
  monthBalance,
  focus,
  onFocus,
  months,
  ym,
}: {
  previousMonthBalance: number
  incomeActual: number
  discountActual: number
  lifeActual: number
  monthBalance: number
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
      <div className={`${styles.heroCards} ${styles.heroCardsRaioX}`} aria-label="Indicadores do Raio-X">
        <div className={`${styles.heroCard} ${styles.heroCardStatic}`}>
          <span>Saldo do mês anterior</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(previousMonthBalance)}`}>
            {formatMoney(previousMonthBalance)}
          </strong>
          <span className={styles.muted}>Caixa ao fim do mês anterior</span>
        </div>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'income' ? styles.heroCardIncomeActive : ''}`}
          aria-pressed={focus === 'income'}
          onClick={() => onFocus('income')}
        >
          <span>Renda recebida</span>
          <strong className={`${styles.moneyValue} ${styles.positive}`}>{formatMoney(incomeActual)}</strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'discount' ? styles.heroCardDiscountActive : ''}`}
          aria-pressed={focus === 'discount'}
          onClick={() => onFocus('discount')}
        >
          <span>Descontos realizados</span>
          <strong className={`${styles.moneyValue} ${discountActual > 0 ? styles.negative : ''}`}>
            {formatMoney(discountActual)}
          </strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'spendable' ? styles.heroCardSpendableActive : ''}`}
          aria-pressed={focus === 'spendable'}
          onClick={() => onFocus('spendable')}
        >
          <span>Renda gastável</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(gastavel)}`}>
            {formatMoney(gastavel)}
          </strong>
          <span className={styles.muted}>Renda recebida − descontos realizados</span>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'life' ? styles.heroCardPatrimonyActive : ''}`}
          aria-pressed={focus === 'life'}
          onClick={() => onFocus('life')}
        >
          <span>Projetos de vida</span>
          <strong className={`${styles.moneyValue} ${lifeActual > 0 ? styles.positive : ''}`}>
            {formatMoney(lifeActual)}
          </strong>
          <span className={styles.muted}>
            {months === 1 ? 'Separado neste mês' : `Separado em ${months} meses`}
          </span>
        </button>
        <div className={`${styles.heroCard} ${styles.heroCardStatic}`}>
          <span>Saldo do mês</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(monthBalance)}`}>
            {formatMoney(monthBalance)}
          </strong>
          <span className={styles.muted}>Renda − descontos − projetos − essencial − social</span>
        </div>
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
                      {formatMoney(bar.planned)} / {formatMoney(bar.actual)}
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
