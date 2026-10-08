import type { Budget, BudgetSectionBlock, ChartSection, PatrimonySummary } from '../api/finance'
import { CASH_FLOW_SECTIONS, compareChartSections } from './chartOrder'

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

export type BudgetMacroBar = {
  section: ChartSection
  name: string
  planned: number
  actual: number
  plannedPct: number
  actualPct: number
}

export type PatrimonyMacroBar = {
  key: 'assets' | 'liabilities'
  label: string
  amount: number
  pct: number
}

export function buildRaioXHomeInsight(budget: Budget): RaioXHomeInsight {
  const cashSections = budget.sections.filter((block) => CASH_FLOW_SECTIONS.includes(block.section))
  const planned = cashSections.reduce((sum, block) => sum + block.plannedAmount, 0)
  const actual = cashSections.reduce((sum, block) => sum + block.actualAmount, 0)
  const monthPercent = planned > 0 ? (actual / planned) * 100 : null
  return {
    planned,
    actual,
    monthPercent,
    topDeviation: pickTopDeviation(cashSections),
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

/** Planned × actual bars for cash-flow sections (Home macro chart). */
export function buildBudgetMacroBars(budget: Budget): BudgetMacroBar[] {
  const blocks = budget.sections
    .filter((block) => CASH_FLOW_SECTIONS.includes(block.section))
    .slice()
    .sort((a, b) => compareChartSections(a.section, b.section))
  const max = Math.max(1, ...blocks.flatMap((block) => [block.plannedAmount, block.actualAmount]))
  return blocks.map((block) => ({
    section: block.section,
    name: block.name,
    planned: block.plannedAmount,
    actual: block.actualAmount,
    plannedPct: Math.min(100, (block.plannedAmount / max) * 100),
    actualPct: Math.min(100, (block.actualAmount / max) * 100),
  }))
}

export function buildPatrimonyMacroBars(summary: PatrimonySummary): PatrimonyMacroBar[] {
  const max = Math.max(1, summary.assetsTotal, summary.liabilitiesTotal)
  return [
    {
      key: 'assets',
      label: 'Ativo',
      amount: summary.assetsTotal,
      pct: Math.min(100, (summary.assetsTotal / max) * 100),
    },
    {
      key: 'liabilities',
      label: 'Passivo',
      amount: summary.liabilitiesTotal,
      pct: Math.min(100, (summary.liabilitiesTotal / max) * 100),
    },
  ]
}
