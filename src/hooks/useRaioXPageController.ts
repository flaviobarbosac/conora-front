import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  accountsApi,
  budgetsApi,
  categoriesApi,
  entriesApi,
  projectsApi,
  type BudgetYear,
  type Category,
  type Entry,
  type SharingScope,
} from '../api/finance'
import { useLoad } from './useLoad'
import { usePlanAccess } from './usePlanAccess'
import { categoryLabel } from '../lib/categoryLabel'
import { compareCategorySiblings } from '../lib/categoryOrder'
import { currentCompetence, shiftCompetence } from '../lib/format'
import { filterCategoriesForPlan, hasFullAccess, isFreeLimited } from '../lib/freeTier'
import {
  aggregateYearMonths,
  buildAmountMaps,
  chartWithAmounts,
  groupAccountsByParent,
  idsWithAmount,
  monthsEndingAt,
  sectionHead,
  yearsNeededForMonths,
  type RaioXFocus,
} from '../lib/raioX'
import { readSharingView } from '../lib/sharingView'
import { clearRaioXReturn, readRaioXReturn } from '../lib/raioXReturn'
import {
  MONTHS_MAX,
  MONTHS_MIN,
  ancestorIds,
  branchHasLeakage,
  isRaioXVisibleAccount,
  parseSectionParam,
} from '../pages/raioX/raioXShared'

/** Container state + data loads for Raio-X (presentational page stays thin). */
export function useRaioXPageController() {
  const { plan } = usePlanAccess()
  const freeLimited = isFreeLimited(plan)
  const fullAccess = hasFullAccess(plan)
  const [searchParams, setSearchParams] = useSearchParams()
  const focusSection = useMemo(
    () => parseSectionParam(searchParams.get('section')),
    [searchParams],
  )
  const [ym, setYm] = useState(() => searchParams.get('competenceYm') || currentCompetence())
  const [months, setMonths] = useState(() => {
    const raw = Number(searchParams.get('months'))
    return Number.isFinite(raw) && raw >= MONTHS_MIN && raw <= MONTHS_MAX ? raw : MONTHS_MIN
  })
  const [focus, setFocus] = useState<RaioXFocus>(null)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [scope, setScope] = useState<SharingScope>(readSharingView)
  const [leakageOnly, setLeakageOnly] = useState(false)
  const [treeMenuOpen, setTreeMenuOpen] = useState(false)
  const restoredReturnRef = useRef(false)

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
    () => entriesApi.list({ competenceYm: ym, take: 500, scope }),
    [ym, scope],
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

  const list = useMemo(() => {
    const filtered = filterCategoriesForPlan(accounts.data ?? [], plan, { keepPendingReview: false })
    return chartWithAmounts(filtered, idsWithAmount([planned, actual]), false).filter(
      isRaioXVisibleAccount,
    )
  }, [accounts.data, plan, planned, actual])
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
  const rootRows = useMemo(
    () => [incomeHead, expenseHead].filter(Boolean) as Category[],
    [incomeHead, expenseHead],
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
      if (!entry.categoryId) continue
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
    if (
      focusSection === 'Patrimony' ||
      focusSection === 'Asset' ||
      focusSection === 'Liability' ||
      focusSection === 'LifeProject'
    ) {
      return
    }
    const head =
      focusSection === 'Expense'
        ? expenseHead
        : focusSection === 'Budget'
          ? list.find((account) => account.code === 'BUDGET')
          : sectionHead(list, focusSection)
    if (!head || !isRaioXVisibleAccount(head)) {
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
  }, [focusSection, list, expenseHead, rootRows, searchParams, setSearchParams])

  useEffect(() => {
    if (restoredReturnRef.current || list.length === 0) {
      return
    }
    if (budget.loading && !budget.data) {
      return
    }
    const saved = readRaioXReturn()
    if (!saved) {
      return
    }
    restoredReturnRef.current = true
    const safeMonths =
      Number.isFinite(saved.months) && saved.months >= MONTHS_MIN && saved.months <= MONTHS_MAX
        ? saved.months
        : MONTHS_MIN
    setYm(saved.competenceYm)
    setMonths(safeMonths)
    setLeakageOnly(saved.leakageOnly)
    setOpen(new Set(saved.openIds))
    const nextParams = new URLSearchParams()
    nextParams.set('competenceYm', saved.competenceYm)
    if (safeMonths > MONTHS_MIN) {
      nextParams.set('months', String(safeMonths))
    }
    setSearchParams(nextParams, { replace: true })
    const timer = window.setTimeout(() => {
      window.scrollTo(0, saved.scrollY)
      clearRaioXReturn()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [list.length, budget.loading, budget.data, setSearchParams])

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

  return {
    plan,
    freeLimited,
    fullAccess,
    searchParams,
    setSearchParams,
    focusSection,
    ym,
    setYm,
    months,
    setMonths,
    focus,
    setFocus,
    open,
    setOpen,
    scope,
    setScope,
    leakageOnly,
    setLeakageOnly,
    treeMenuOpen,
    setTreeMenuOpen,
    restoredReturnRef,
    monthList,
    yearNums,
    yearKey,
    previousYm,
    budget,
    yearsBudget,
    previousCash,
    accounts,
    entries,
    bankAccounts,
    planned,
    actual,
    list,
    byParent,
    incomeHead,
    expenseHead,
    rootRows,
    hasLeakage,
    categoryNameById,
    bankNameById,
    entriesByAccount,
    projects,
  }
}
