export type CloseGapLike = {
  categoryId: string
  categoryName: string
  openAmount: number
  alreadyRegistered: boolean
}

export type BudgetLineLike = {
  categoryId: string | null
  categoryName: string
  plannedAmount: number
  actualAmount: number
  isGroup: boolean
}

export type LeakageRow = {
  categoryId: string
  categoryName: string
  plannedAmount: number
  actualAmount: number
  overAmount: number
}

export type UnpostedRow = {
  categoryId: string
  categoryName: string
  plannedAmount: number
}

/** Gaps marked as debt (including ones already registered) vs leftover surplus. */
export function sumDebtAndSurplus(gaps: CloseGapLike[], debtIds: string[]) {
  let debtTotal = 0
  let surplusTotal = 0
  for (const gap of gaps) {
    if (gap.alreadyRegistered || debtIds.includes(gap.categoryId)) {
      debtTotal += gap.openAmount
    } else {
      surplusTotal += gap.openAmount
    }
  }
  return { debtTotal, surplusTotal }
}

/** Newly checked debts this close (excludes alreadyRegistered). */
export function sumNewDebt(gaps: CloseGapLike[], debtIds: string[]) {
  return gaps
    .filter((gap) => !gap.alreadyRegistered && debtIds.includes(gap.categoryId))
    .reduce((sum, gap) => sum + gap.openAmount, 0)
}

/** Analytical lines where actual exceeded planned, highest overrun first. */
export function topLeakages(lines: BudgetLineLike[], limit = 3): LeakageRow[] {
  return lines
    .filter(
      (line) =>
        !line.isGroup &&
        Boolean(line.categoryId) &&
        line.plannedAmount > 0 &&
        line.actualAmount > line.plannedAmount,
    )
    .map((line) => ({
      categoryId: line.categoryId as string,
      categoryName: line.categoryName,
      plannedAmount: line.plannedAmount,
      actualAmount: line.actualAmount,
      overAmount: line.actualAmount - line.plannedAmount,
    }))
    .sort((a, b) => b.overAmount - a.overAmount)
    .slice(0, limit)
}

/** Analytical lines with planned amount and zero actual, highest planned first. */
export function topUnposted(lines: BudgetLineLike[], limit = 5): UnpostedRow[] {
  return lines
    .filter(
      (line) =>
        !line.isGroup &&
        Boolean(line.categoryId) &&
        line.plannedAmount > 0 &&
        line.actualAmount === 0,
    )
    .map((line) => ({
      categoryId: line.categoryId as string,
      categoryName: line.categoryName,
      plannedAmount: line.plannedAmount,
    }))
    .sort((a, b) => b.plannedAmount - a.plannedAmount)
    .slice(0, limit)
}

/** How far expenses sit above planned (0 when within). */
export function budgetOverAmount(totalPlanned: number, totalActual: number) {
  return Math.max(0, totalActual - totalPlanned)
}
