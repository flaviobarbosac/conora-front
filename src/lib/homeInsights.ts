import type { Budget, BudgetSectionBlock, ChartSection, PatrimonySummary } from '../api/finance'
import { CASH_FLOW_SECTIONS } from './chartOrder'
import { progressPercent, progressTone, spendableIncomeBox, type ProgressTone } from './raioX'

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
  /** Single progress bar width 0–100 (capped). */
  progressPct: number
  tone: ProgressTone
}

export type PatrimonyMacroBar = {
  key: 'assets' | 'liabilities'
  label: string
  amount: number
  pct: number
}

export function buildRaioXHomeInsight(budget: Budget): RaioXHomeInsight {
  const cashSections = budget.sections.filter((block) => CASH_FLOW_SECTIONS.includes(block.section))
  const planned = cashSections.reduce((sum, block) => sum + Math.abs(block.plannedAmount), 0)
  const actual = cashSections.reduce((sum, block) => sum + Math.abs(block.actualAmount), 0)
  const monthPercent = progressPercent({ planned, actual })
  const gastavel = spendableIncomeBox(budget)
  return {
    planned,
    actual,
    monthPercent,
    topDeviation: pickTopDeviation(cashSections),
    received: budget.receivedIncome,
    /** Renda gastável do mês = receita − descontos (not diagnosis net). */
    spendable: gastavel.actual > 0 ? gastavel.actual : gastavel.planned,
  }
}

export function pickTopDeviation(
  sections: BudgetSectionBlock[],
): { name: string; percent: number } | null {
  let top: { name: string; percent: number } | null = null
  for (const section of sections) {
    const planned = Math.abs(section.plannedAmount)
    if (planned <= 0) {
      continue
    }
    const percent = progressPercent({
      planned,
      actual: Math.abs(section.actualAmount),
    })
    if (percent === null) {
      continue
    }
    if (!top || Math.abs(percent - 100) > Math.abs(top.percent - 100)) {
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

/** One progress bar per cash-flow section (Income + despesas). */
export function buildBudgetMacroBars(budget: Budget): BudgetMacroBar[] {
  const bySection = new Map(budget.sections.map((block) => [block.section, block]))
  return CASH_FLOW_SECTIONS.map((section) => {
    const block = bySection.get(section)
    const planned = Math.abs(block?.plannedAmount ?? 0)
    const actual = Math.abs(block?.actualAmount ?? 0)
    const percent = progressPercent({ planned, actual })
    const tone = progressTone(percent, { planned, actual })
    return {
      section,
      name: block?.name ?? sectionLabel(section),
      planned,
      actual,
      progressPct: percent === null ? 0 : Math.min(100, percent),
      tone,
    }
  }).filter((bar) => bar.planned > 0 || bar.actual > 0 || bySection.has(bar.section))
}

function sectionLabel(section: ChartSection): string {
  switch (section) {
    case 'Income':
      return 'Receita'
    case 'Discount':
      return 'Desconto'
    case 'LifeProject':
      return 'Projetos de vida'
    case 'Essential':
      return 'Essencial'
    case 'Social':
      return 'Social'
    case 'Asset':
      return 'Ativo'
    case 'Liability':
      return 'Passivo'
    default:
      return section
  }
}

export function buildPatrimonyMacroBars(summary: PatrimonySummary): PatrimonyMacroBar[] {
  const max = Math.max(1, Math.abs(summary.assetsTotal), Math.abs(summary.liabilitiesTotal))
  return [
    {
      key: 'assets',
      label: 'Ativo',
      amount: Math.abs(summary.assetsTotal),
      pct: Math.min(100, (Math.abs(summary.assetsTotal) / max) * 100),
    },
    {
      key: 'liabilities',
      label: 'Passivo',
      amount: Math.abs(summary.liabilitiesTotal),
      pct: Math.min(100, (Math.abs(summary.liabilitiesTotal) / max) * 100),
    },
  ]
}
