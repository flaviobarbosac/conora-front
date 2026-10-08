import type { BudgetLine, ChartAccount } from '../api/finance'

export type RaioXTotals = { planned: number; actual: number }

/** Rolls up planned/actual from analytical leaves through the chart tree. */
export function sumBranch(
  accountId: string,
  byParent: Map<string | null, ChartAccount[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
): RaioXTotals {
  const children = byParent.get(accountId) ?? []
  if (children.length === 0) {
    return {
      planned: planned.get(accountId) ?? 0,
      actual: actual.get(accountId) ?? 0,
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
 * Variation as percent of planned.
 * 0/0 → 0; actual with no planned → null (undefined base).
 */
export function variationPercent(totals: RaioXTotals): number | null {
  if (totals.planned === 0) {
    return totals.actual === 0 ? 0 : null
  }
  return ((totals.actual - totals.planned) / totals.planned) * 100
}

/** Prefer analytical lines so group rows are not double-counted. */
export function buildAmountMaps(lines: BudgetLine[]): {
  planned: Map<string, number>
  actual: Map<string, number>
} {
  const plannedMap = new Map<string, number>()
  const actualMap = new Map<string, number>()
  const analytical = lines.filter((line) => line.chartAccountId && !line.isGroup)
  const source = analytical.length > 0 ? analytical : lines.filter((line) => line.chartAccountId)

  for (const line of source) {
    const id = line.chartAccountId!
    plannedMap.set(id, (plannedMap.get(id) ?? 0) + line.plannedAmount)
    actualMap.set(id, (actualMap.get(id) ?? 0) + line.actualAmount)
  }
  return { planned: plannedMap, actual: actualMap }
}

export function groupAccountsByParent(accounts: ChartAccount[]): Map<string | null, ChartAccount[]> {
  const map = new Map<string | null, ChartAccount[]>()
  for (const account of accounts) {
    const bucket = map.get(account.parentId) ?? []
    bucket.push(account)
    map.set(account.parentId, bucket)
  }
  return map
}
