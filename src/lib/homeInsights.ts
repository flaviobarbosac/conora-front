import type { Budget, BudgetSectionBlock, PatrimonySummary } from '../api/finance'

export type RaioXHomeInsight = {
  planned: number
  actual: number
  monthPercent: number | null
  topDeviation: { name: string; percent: number } | null
  received: number
  spendable: number
}

export type PatrimonyHomeInsight = {
  netWorth: number
  assetsTotal: number
  liabilitiesTotal: number
}

export function buildRaioXHomeInsight(budget: Budget): RaioXHomeInsight {
  const planned = budget.totalPlanned
  const actual = budget.totalActual
  const monthPercent = planned > 0 ? (actual / planned) * 100 : null
  return {
    planned,
    actual,
    monthPercent,
    topDeviation: pickTopDeviation(budget.sections),
    received: budget.receivedIncome,
    spendable: budget.spendableIncome,
  }
}

export function pickTopDeviation(
  sections: BudgetSectionBlock[],
): { name: string; percent: number } | null {
  let top: { name: string; percent: number } | null = null
  for (const section of sections) {
    if (section.plannedAmount <= 0) {
      continue
    }
    const percent = ((section.actualAmount - section.plannedAmount) / section.plannedAmount) * 100
    if (!top || Math.abs(percent) > Math.abs(top.percent)) {
      top = { name: section.name, percent }
    }
  }
  return top
}

export function buildPatrimonyHomeInsight(summary: PatrimonySummary): PatrimonyHomeInsight {
  return {
    netWorth: summary.netWorth,
    assetsTotal: summary.assetsTotal,
    liabilitiesTotal: summary.liabilitiesTotal,
  }
}
