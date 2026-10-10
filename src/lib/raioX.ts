import type { Budget, BudgetLine, BudgetYear, Category, CategorySection, PatrimonySummary } from '../api/finance'
import { CASH_FLOW_SECTIONS, isCashFlowSection } from './categoryOrder'
import { monthsInclusive, shiftCompetence } from './format'

export type RaioXTotals = { planned: number; actual: number }

export type ProgressTone = 'ok' | 'over' | 'muted' | 'unbudgeted'

/** Rolls up planned/actual from analytical leaves through the category tree. */
export function sumBranch(
  accountId: string,
  byParent: Map<string | null, Category[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
): RaioXTotals {
  const children = byParent.get(accountId) ?? []
  if (children.length === 0) {
    return {
      planned: Math.abs(planned.get(accountId) ?? 0),
      actual: Math.abs(actual.get(accountId) ?? 0),
    }
  }

  let plannedTotal = 0
  let actualTotal = 0
  for (const child of children) {
    const childTotals = sumBranch(child.id, byParent, planned, actual)
    plannedTotal += childTotals.planned
    actualTotal += childTotals.actual
  }
  return { planned: plannedTotal, actual: actualTotal }
}

/**
 * Progress as percent of planned (always ≥ 0 when defined).
 * planned ≤ 0 → null (no budget base); otherwise actual/planned×100.
 */
export function progressPercent(totals: RaioXTotals): number | null {
  const planned = Math.abs(totals.planned)
  const actual = Math.abs(totals.actual)
  if (planned <= 0) {
    return null
  }
  return (actual / planned) * 100
}

/** @deprecated Use progressPercent — kept as alias for call sites during migration. */
export function variationPercent(totals: RaioXTotals): number | null {
  return progressPercent(totals)
}

/** Yellow unbudgeted when there is no planned amount; otherwise ok / over / muted. */
export function progressTone(percent: number | null, totals?: RaioXTotals): ProgressTone {
  if (percent === null || (totals && Math.abs(totals.planned) <= 0)) {
    return 'unbudgeted'
  }
  if (percent <= 0 && Math.abs(totals?.actual ?? 0) <= 0) {
    return 'muted'
  }
  return percent > 100 ? 'over' : 'ok'
}

/** Prefer analytical lines so group rows are not double-counted. */
export function buildAmountMaps(lines: BudgetLine[]): {
  planned: Map<string, number>
  actual: Map<string, number>
} {
  const plannedMap = new Map<string, number>()
  const actualMap = new Map<string, number>()
  const analytical = lines.filter((line) => line.categoryId && !line.isGroup)
  const source = analytical.length > 0 ? analytical : lines.filter((line) => line.categoryId)

  for (const line of source) {
    const id = line.categoryId!
    plannedMap.set(id, (plannedMap.get(id) ?? 0) + Math.abs(line.plannedAmount))
    actualMap.set(id, (actualMap.get(id) ?? 0) + Math.abs(line.actualAmount))
  }
  return { planned: plannedMap, actual: actualMap }
}

export function groupAccountsByParent(accounts: Category[]): Map<string | null, Category[]> {
  const map = new Map<string | null, Category[]>()
  for (const account of accounts) {
    const bucket = map.get(account.parentId) ?? []
    bucket.push(account)
    map.set(account.parentId, bucket)
  }
  return map
}

export function sectionPlannedActual(
  budget: Budget,
  section: CategorySection,
): RaioXTotals {
  const block = budget.sections.find((item) => item.section === section)
  if (block) {
    return { planned: Math.abs(block.plannedAmount), actual: Math.abs(block.actualAmount) }
  }
  const lines = budget.lines.filter((line) => line.section === section && !line.isGroup)
  return {
    planned: lines.reduce((sum, line) => sum + Math.abs(line.plannedAmount), 0),
    actual: lines.reduce((sum, line) => sum + Math.abs(line.actualAmount), 0),
  }
}

export function incomePlanned(budget: Budget): number {
  const fromSection = sectionPlannedActual(budget, 'Income').planned
  return fromSection > 0 ? fromSection : Math.abs(budget.spendableIncome)
}

export function discountTotals(budget: Budget): RaioXTotals {
  return sectionPlannedActual(budget, 'Discount')
}

/** Renda gastável = receita − descontos (never negative). */
export function spendableIncomeBox(budget: Budget): { planned: number; actual: number } {
  const incomePlannedValue = incomePlanned(budget)
  const incomeActual = Math.abs(budget.receivedIncome)
  const discount = discountTotals(budget)
  return {
    planned: Math.max(0, incomePlannedValue - discount.planned),
    actual: Math.max(0, incomeActual - discount.actual),
  }
}

export function monthsEndingAt(endYm: string, count: number): string[] {
  if (count <= 1) {
    return [endYm]
  }
  const start = shiftCompetence(endYm, -(count - 1))
  return monthsInclusive(start, endYm)
}

/** Aggregate planned/actual maps across months from one or two BudgetYear payloads. */
export function aggregateYearMonths(
  years: BudgetYear[],
  monthList: string[],
): { planned: Map<string, number>; actual: Map<string, number> } {
  const planned = new Map<string, number>()
  const actual = new Map<string, number>()
  const wanted = new Set(monthList)

  for (const year of years) {
    for (const line of year.lines) {
      if (!line.categoryId) {
        continue
      }
      for (const cell of line.months) {
        if (!wanted.has(cell.competenceYm)) {
          continue
        }
        planned.set(
          line.categoryId,
          (planned.get(line.categoryId) ?? 0) + Math.abs(cell.plannedAmount),
        )
        actual.set(
          line.categoryId,
          (actual.get(line.categoryId) ?? 0) + Math.abs(cell.actualAmount),
        )
      }
    }
  }
  return { planned, actual }
}

export function yearsNeededForMonths(monthList: string[]): number[] {
  const years = new Set(monthList.map((ym) => Number(ym.slice(0, 4))))
  return [...years].sort((a, b) => a - b)
}

export type RaioXFocus = 'income' | 'discount' | 'spendable' | 'life' | 'patrimony' | null

export function focusSections(focus: RaioXFocus): CategorySection[] {
  switch (focus) {
    case 'income':
      return ['Income']
    case 'discount':
      // Hero "Descontos realizados" highlights the Despesa master in the tree (not Descontos).
      return ['Expense']
    case 'spendable':
      return ['Income', 'Expense']
    case 'life':
      return ['LifeProject']
    case 'patrimony':
      return ['Asset', 'Liability', 'Patrimony']
    default:
      return []
  }
}

export function isBudgetEditableSection(section: CategorySection): boolean {
  return isCashFlowSection(section)
}

/** Head account of a posting section (Receita, Descontos…), not nested under the same section. */
export function sectionHead(
  accounts: Category[],
  section: CategorySection,
): Category | undefined {
  return accounts.find((account) => {
    if (account.section !== section || account.level === 'Analytical') {
      return false
    }
    const parent = accounts.find((item) => item.id === account.parentId)
    return !parent || parent.section !== section
  })
}

/** Realized total of a section, same rollup the Raio-X tree shows on the head row. */
export function sectionRealized(
  byParent: Map<string | null, Category[]>,
  actual: Map<string, number>,
  section: CategorySection,
  accounts?: Category[],
): number {
  const planned = new Map<string, number>()
  if (accounts) {
    const head = sectionHead(accounts, section)
    return head ? sumBranch(head.id, byParent, planned, actual).actual : 0
  }
  const roots = (byParent.get(null) ?? []).filter(
    (account) => account.level === 'Root' && account.section === section,
  )
  return roots.reduce((sum, root) => sum + sumBranch(root.id, byParent, planned, actual).actual, 0)
}

/** Item amounts keyed by category. Groups roll up with sumBranch. */
export function patrimonyStockMap(items: { categoryId: string; amount: number }[]): Map<string, number> {
  const actual = new Map<string, number>()
  for (const item of items) {
    actual.set(item.categoryId, (actual.get(item.categoryId) ?? 0) + Math.abs(item.amount))
  }
  return actual
}

export function patrimonyRootAmounts(summary: PatrimonySummary): {
  assets: number
  liabilities: number
  netWorth: number
  /** @deprecated Prefer netWorth (signed). */
  netWorthAbs: number
} {
  return {
    assets: Math.abs(summary.assetsTotal),
    liabilities: Math.abs(summary.liabilitiesTotal),
    netWorth: summary.netWorth,
    netWorthAbs: Math.abs(summary.netWorth),
  }
}

export { CASH_FLOW_SECTIONS }
