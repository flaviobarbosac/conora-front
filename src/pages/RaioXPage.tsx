import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  accountsApi,
  budgetsApi,
  categoriesApi,
  entriesApi,
  projectsApi,
  type Budget,
  type BudgetYear,
  type Category,
  type CategorySection,
  type Entry,
  type LifeProject,
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
import { LIFE_HORIZONS } from '../lib/lifeHorizon'
import { compareCategorySiblings, isCashFlowSection } from '../lib/categoryOrder'
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
import { hasFullAccess, isFreeCategoryCode, isFreeLimited } from '../lib/freeTier'
import { usePlanAccess } from '../hooks/usePlanAccess'
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
  onActualClick,
}: {
  totals: RaioXTotals
  stock?: boolean
  onUnbudgetedClick?: () => void
  onActualClick?: () => void
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
  const actualClass = `${styles.raioxAmount} ${styles.moneyValue}${tone === 'over' ? ` ${styles.negative}` : ''}`
  return (
    <span className={styles.raioxTotals}>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.planned)}</span>
      {onActualClick && Math.abs(totals.actual) > 0.001 ? (
        <button
          type="button"
          className={`${actualClass} ${styles.raioxPercentLink}`}
          title="Abrir lançamentos"
          onClick={(event) => {
            event.stopPropagation()
            onActualClick()
          }}
        >
          {formatMoney(totals.actual)}
        </button>
      ) : (
        <span className={actualClass}>{formatMoney(totals.actual)}</span>
      )}
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
  const { plan } = usePlanAccess()
  const freeLimited = isFreeLimited(plan)
  const fullAccess = hasFullAccess(plan)
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
  const [leakageOnly, setLeakageOnly] = useState(false)
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
  const accounts = useLoad(() => categoriesApi.list(undefined, false, false), [])
  const entries = useLoad(
    () =>
      months === 1
        ? entriesApi.list({ competenceYm: ym, take: 200, scope })
        : Promise.resolve({ items: [], skip: 0, take: 0, totalCount: 0 }),
    [ym, months, scope],
  )
  const bankAccounts = useLoad(() => accountsApi.list(), [])
  const projects = useLoad(() => projectsApi.list(), [])

  useEffect(() => {
    function onVoiceSaved() {
      entries.reload()
      budget.reload()
    }
    window.addEventListener('conora:voice-saved', onVoiceSaved)
    return () => window.removeEventListener('conora:voice-saved', onVoiceSaved)
  }, [entries.reload, budget.reload])

  const { planned, actual } = useMemo(() => {
    if (months === 1) {
      return buildAmountMaps(budget.data?.lines ?? [])
    }
    return aggregateYearMonths(yearsBudget.data ?? [], monthList)
  }, [months, budget.data, yearsBudget.data, monthList])

  const list = useMemo(
    () => chartWithAmounts(accounts.data ?? [], idsWithAmount([planned, actual]), false),
    [accounts.data, planned, actual],
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
  const hasLeakage = useMemo(
    () => rootRows.some((root) => branchHasLeakage(root.id, byParent, planned, actual)),
    [rootRows, byParent, planned, actual],
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

  function categoryUnlocked(account: Category): boolean {
    if (fullAccess) return true
    if (account.level !== 'Analytical') {
      // Groups stay expandable so the user sees locked children in gray.
      return true
    }
    return isFreeCategoryCode(account.code)
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
      entry: entry.id,
      competenceYm: entry.competenceYm || ym,
    })
    navigate(`/lancamentos?${params.toString()}`)
  }

  function openActualForAccount(account: Category, launchEntries: Entry[]) {
    if (!categoryUnlocked(account)) return
    if (launchEntries.length === 1) {
      openEntry(launchEntries[0])
      return
    }
    if (launchEntries.length > 1) {
      setOpen((prev) => new Set(prev).add(account.id))
      return
    }
    setOpen((prev) => new Set(prev).add(account.id))
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
            <label className={styles.leakageFilter} onClick={(event) => event.stopPropagation()}>
              <input
                type="checkbox"
                checked={leakageOnly}
                onChange={(event) => setLeakageOnly(event.target.checked)}
              />
              Mostrar só contas acima de 100% (vazamento)
            </label>
          </>
        }
      />
      <ErrorText
        message={
          budget.error ??
          previousCash.error ??
          accounts.error ??
          entries.error ??
          yearsBudget.error ??
          projects.error
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
          accounts={list}
          byParent={byParent}
          planned={planned}
          actual={actual}
          projects={(projects.data ?? []).filter((project) =>
            scope === 'Family' ? true : project.scope === 'Personal',
          )}
          projectsLoading={projects.loading && !projects.data}
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
      {rootRows.length > 0 && leakageOnly && !hasLeakage ? (
        <section className={styles.celebrateInline} aria-label="Sem vazamento de orçamento">
          <img
            className={styles.celebrateSymbol}
            src={`${import.meta.env.BASE_URL}brand/simbolo.png`}
            alt=""
            width={72}
            height={72}
          />
          <h2 className={styles.celebrateTitle}>Parabéns</h2>
          <p className={styles.celebrateMessage}>
            Nenhuma categoria passou do orçamento. Seu mês está no eixo.
          </p>
        </section>
      ) : null}
      {rootRows.length > 0 && !(leakageOnly && !hasLeakage) ? (
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
              open={open}
              highlighted={highlighted}
              entriesByAccount={entriesByAccount}
              categoryNameById={categoryNameById}
              bankNameById={bankNameById}
              leakageOnly={leakageOnly}
              freeLimited={freeLimited}
              categoryUnlocked={categoryUnlocked}
              onToggle={toggle}
              onOpenEntry={openEntry}
              onOpenActual={openActualForAccount}
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
  const headline = [categoryName, accountName, formatDate(entry.occurredAt)].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      className={`${styles.raioxRow} ${styles.raioxEntry}`}
      style={{
        paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)`,
      }}
      onClick={() => onOpen(entry)}
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

function branchHasLeakage(
  accountId: string,
  byParent: Map<string | null, Category[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
): boolean {
  const children = byParent.get(accountId) ?? []
  if (children.length === 0) {
    const pct = progressPercent({
      planned: planned.get(accountId) ?? 0,
      actual: actual.get(accountId) ?? 0,
    })
    return pct !== null && pct > 100
  }
  return children.some((child) => branchHasLeakage(child.id, byParent, planned, actual))
}

function RaioXAccountBlock({
  account,
  depth,
  byParent,
  planned,
  actual,
  open,
  highlighted,
  entriesByAccount,
  categoryNameById,
  bankNameById,
  leakageOnly,
  freeLimited,
  categoryUnlocked,
  onToggle,
  onOpenEntry,
  onOpenActual,
  onUnbudgetedClick,
}: {
  account: Category
  depth: number
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  actual: Map<string, number>
  open: Set<string>
  highlighted: CategorySection[]
  entriesByAccount: Map<string, Entry[]>
  categoryNameById: Map<string, string>
  bankNameById: Map<string, string>
  leakageOnly: boolean
  freeLimited: boolean
  categoryUnlocked: (account: Category) => boolean
  onToggle: (id: string) => void
  onOpenEntry: (entry: Entry) => void
  onOpenActual: (account: Category, launchEntries: Entry[]) => void
  onUnbudgetedClick: (accountId: string) => void
}) {
  if (leakageOnly && !branchHasLeakage(account.id, byParent, planned, actual)) {
    return null
  }
  const children = (byParent.get(account.id) ?? []).filter(
    (child) => !leakageOnly || branchHasLeakage(child.id, byParent, planned, actual),
  )
  const launchEntries =
    account.level === 'Analytical' ? (entriesByAccount.get(account.id) ?? []) : []
  const leafActual = account.level === 'Analytical' ? (actual.get(account.id) ?? 0) : 0
  const unlocked = categoryUnlocked(account)
  const lockedLeaf = freeLimited && account.level === 'Analytical' && !unlocked
  const expandable =
    !lockedLeaf && (children.length > 0 || launchEntries.length > 0 || leafActual !== 0)
  const expanded = open.has(account.id)
  const totals = sumBranch(account.id, byParent, planned, actual)
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
        className={`${styles.raioxRow} ${rowClass} ${focused}${lockedLeaf ? ` ${styles.muted}` : ''}`}
        style={{
          paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)`,
          opacity: lockedLeaf ? 0.55 : undefined,
          cursor: lockedLeaf ? 'default' : undefined,
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (expandable) {
            onToggle(account.id)
          }
        }}
        aria-expanded={expandable ? expanded : undefined}
        aria-disabled={lockedLeaf || undefined}
        title={lockedLeaf ? 'Liberado nos planos pagos' : undefined}
      >
        <span className={styles.raioxToggle} aria-hidden>
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>{categoryLabel(account)}</strong>
        <TotalsCell
          totals={totals}
          onUnbudgetedClick={
            unlocked && account.level === 'Analytical' ? () => onUnbudgetedClick(account.id) : undefined
          }
          onActualClick={
            unlocked && account.level === 'Analytical'
              ? () => onOpenActual(account, launchEntries)
              : undefined
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
              open={open}
              highlighted={highlighted}
              entriesByAccount={entriesByAccount}
              categoryNameById={categoryNameById}
              bankNameById={bankNameById}
              leakageOnly={leakageOnly}
              freeLimited={freeLimited}
              categoryUnlocked={categoryUnlocked}
              onToggle={onToggle}
              onOpenEntry={onOpenEntry}
              onOpenActual={onOpenActual}
              onUnbudgetedClick={onUnbudgetedClick}
            />
          ))
        : null}
      {expanded && unlocked
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
      {expanded && account.level === 'Analytical' && children.length === 0 && launchEntries.length === 0 ? (
        <div
          className={`${styles.raioxRow} ${styles.raioxEntry}`}
          style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
        >
          <span />
          <span className={styles.muted}>Nenhum lançamento nesta conta.</span>
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

function sectionTotals(
  accounts: Category[],
  byParent: Map<string | null, Category[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
  section: CategorySection,
): RaioXTotals {
  const head = sectionHead(accounts, section)
  if (!head) {
    return { planned: 0, actual: 0 }
  }
  return sumBranch(head.id, byParent, planned, actual)
}

function RaioXSideCards({
  budget,
  accounts,
  byParent,
  planned,
  actual,
  projects,
  projectsLoading,
  focus,
  onFocus,
  onExpandSection,
}: {
  budget: Budget
  accounts: Category[]
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  actual: Map<string, number>
  projects: LifeProject[]
  projectsLoading: boolean
  focus: RaioXFocus
  onFocus: (next: RaioXFocus) => void
  onExpandSection: (section: CategorySection) => void
}) {
  const assets = sectionTotals(accounts, byParent, planned, actual, 'Asset')
  const liabilities = sectionTotals(accounts, byParent, planned, actual, 'Liability')
  const net = {
    planned: assets.planned - liabilities.planned,
    actual: assets.actual - liabilities.actual,
  }
  const patrimonyActive = focus === 'patrimony'
  const bars = buildBudgetMacroBars(budget)

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
                    <span className={styles.moneyValue}>{consumptionLabel(bar.planned, bar.actual)}</span>
                  </span>
                  <ConsumptionBar percent={bar.progressPct} color={accountBarColor(bar.section)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className={styles.macroSplit}>
      <section className={styles.macroCard} aria-label="Patrimônio" onClick={(event) => event.stopPropagation()}>
        <div className={styles.macroHead}>
          <strong>Patrimônio</strong>
        </div>
        <div className={styles.heroCards}>
          <PairCard
            label="Ativo"
            totals={assets}
            active={patrimonyActive}
            amountClass={styles.positive}
            onClick={() => onFocus('patrimony')}
          />
          <PairCard
            label="Passivo"
            totals={liabilities}
            active={patrimonyActive}
            amountClass={styles.negative}
            onClick={() => onFocus('patrimony')}
          />
          <PairCard
            label="Patrimônio líquido"
            totals={net}
            active={patrimonyActive}
            amountClass={net.actual < 0 ? styles.negative : ''}
            note="Ativo − passivo"
            onClick={() => onFocus('patrimony')}
          />
        </div>
      </section>
      <section
        className={styles.macroCard}
        aria-label="Projetos de vida"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.macroHead}>
          <strong>Projetos de vida</strong>
        </div>
        {projectsLoading ? <Loading /> : null}
        {LIFE_HORIZONS.map((horizon) => {
          const items = projects.filter((project) => project.horizon === horizon.key)
          const goal = items.reduce((sum, project) => sum + project.goalAmount, 0)
          const accumulated = items.reduce((sum, project) => sum + project.accumulatedAmount, 0)
          const percent = goal <= 0 ? 0 : Math.min(100, (accumulated / goal) * 100)
          return (
            <Link key={horizon.key} className={styles.horizonRow} to={`/projetos?horizonte=${horizon.key}`}>
              <span className={styles.horizonMeta}>
                <strong>{horizon.label}</strong>
                <span>{consumptionLabel(goal, accumulated)}</span>
              </span>
              <ConsumptionBar percent={percent} color={HORIZON_BAR_COLOR[horizon.key]} />
            </Link>
          )
        })}
      </section>
      </div>
    </div>
  )
}

const ACCOUNT_BAR_COLOR = {
  Income: '#2F8A78',
  Discount: '#5B7194',
  Debt: '#B85C6A',
  Essential: '#3F5E8C',
  LifeProject: '#A6843A',
  Social: '#7A5A94',
} as const

function accountBarColor(section: CategorySection): string {
  if (section in ACCOUNT_BAR_COLOR) {
    return ACCOUNT_BAR_COLOR[section as keyof typeof ACCOUNT_BAR_COLOR]
  }
  return '#5B7194'
}

const HORIZON_BAR_COLOR = {
  short: '#3E8F5C',
  mid: '#C47A4E',
  long: '#3A7F94',
} as const

function ConsumptionBar({ percent, color }: { percent: number; color: string }) {
  return (
    <span
      className={styles.progress}
      aria-hidden
      style={{ background: `color-mix(in srgb, ${color} 32%, var(--border-subtle))` }}
    >
      <span
        className={styles.progressFill}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
      />
    </span>
  )
}

/** Fulfilled of total, then the real percent. Same reading as a life-project line. */
function consumptionLabel(total: number, fulfilled: number): string {
  const safeTotal = Number.isFinite(total) ? total : 0
  const safeFulfilled = Number.isFinite(fulfilled) ? fulfilled : 0
  const percent = safeTotal <= 0 ? 0 : (safeFulfilled / safeTotal) * 100
  return `${formatMoney(safeFulfilled)} de ${formatMoney(safeTotal)} · ${formatPercent(Number.isFinite(percent) ? percent : 0)}`
}

function PairCard({
  label,
  totals,
  active,
  amountClass,
  note,
  onClick,
}: {
  label: string
  totals: RaioXTotals
  active: boolean
  amountClass: string
  note?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.heroCard} ${active ? styles.heroCardPatrimonyActive : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong className={`${styles.moneyValue} ${amountClass}`}>{formatMoney(totals.actual)}</strong>
      <span className={styles.muted}>
        Previsto {formatMoney(totals.planned)} · Realizado {formatMoney(totals.actual)}
      </span>
      {note ? <span className={styles.muted}>{note}</span> : null}
    </button>
  )
}
