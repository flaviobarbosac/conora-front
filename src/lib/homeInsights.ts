import type { Budget, BudgetLine, BudgetSectionBlock, CategorySection, PatrimonySummary } from '../api/finance'
import { CASH_FLOW_SECTIONS, EXPENSE_SECTIONS, sectionLabel as categorySectionLabel } from './categoryOrder'
import { progressPercent, progressTone, spendableIncomeBox, type ProgressTone } from './raioX'

export type PieSlice = {
  key: string
  label: string
  amount: number
  pct: number
  color: string
  section?: CategorySection
  categoryId?: string | null
}

export type CompareBar = {
  key: 'income' | 'expense'
  label: string
  planned: number
  actual: number
  /** Progress of realized vs planned (0–100, capped for bar width). */
  progressPct: number
  tone: ProgressTone
  section: CategorySection | 'Expense'
}

const PIE_COLORS = ['#2f9e44', '#375984', '#f59f00', '#e03131', '#6aacff', '#868e96']

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
  section: CategorySection
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

function sectionLabel(section: CategorySection): string {
  return categorySectionLabel(section)
}

function slicesFromLines(
  lines: BudgetLine[],
  predicate: (line: BudgetLine) => boolean,
): PieSlice[] {
  const analytical = lines.filter((line) => !line.isGroup && predicate(line) && Math.abs(line.actualAmount) > 0.001)
  const total = analytical.reduce((sum, line) => sum + Math.abs(line.actualAmount), 0)
  if (total <= 0) {
    return []
  }
  return analytical
    .map((line, index) => {
      const amount = Math.abs(line.actualAmount)
      return {
        key: line.categoryId ?? `${line.section}-${line.categoryName}`,
        label: line.categoryName,
        amount,
        pct: (amount / total) * 100,
        color: PIE_COLORS[index % PIE_COLORS.length]!,
        section: line.section,
        categoryId: line.categoryId,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

/** Realized income by analytical category (for home pie). */
export function buildIncomePieSlices(budget: Budget): PieSlice[] {
  return slicesFromLines(budget.lines, (line) => line.section === 'Income')
}

/** Realized expense by section head (Descontos, Projeto de vida, Essencial, Social). */
export function buildExpensePieSlices(budget: Budget): PieSlice[] {
  const bySection = new Map(budget.sections.map((block) => [block.section, block]))
  const parts = EXPENSE_SECTIONS.map((section) => {
    const block = bySection.get(section)
    const amount = Math.abs(block?.actualAmount ?? 0)
    return { section, label: block?.name ?? sectionLabel(section), amount }
  }).filter((part) => part.amount > 0.001)
  const total = parts.reduce((sum, part) => sum + part.amount, 0)
  if (total <= 0) {
    return []
  }
  return parts.map((part, index) => ({
    key: part.section,
    label: part.label,
    amount: part.amount,
    pct: (part.amount / total) * 100,
    color: PIE_COLORS[index % PIE_COLORS.length]!,
    section: part.section,
  }))
}

/**
 * Horizontal compare:
 * - Receita: realizado / orçado da renda
 * - Despesa: somatório das despesas realizadas / renda gastável (receita − descontos)
 */
export function buildIncomeExpenseCompare(budget: Budget): CompareBar[] {
  const incomeBlock = budget.sections.find((block) => block.section === 'Income')
  const incomePlanned = Math.abs(incomeBlock?.plannedAmount ?? 0)
  const incomeActual = Math.abs(incomeBlock?.actualAmount ?? budget.receivedIncome)
  const expenseActual = EXPENSE_SECTIONS.reduce((sum, section) => {
    const block = budget.sections.find((item) => item.section === section)
    return sum + Math.abs(block?.actualAmount ?? 0)
  }, 0)
  const gastavel = spendableIncomeBox(budget)
  const spendable = gastavel.actual > 0 ? gastavel.actual : gastavel.planned

  function bar(
    key: 'income' | 'expense',
    label: string,
    planned: number,
    actual: number,
    section: CategorySection | 'Expense',
  ): CompareBar {
    const percent = progressPercent({ planned, actual })
    const tone = progressTone(percent, { planned, actual })
    return {
      key,
      label,
      planned,
      actual,
      progressPct: percent === null ? 0 : Math.min(100, percent),
      tone,
      section,
    }
  }

  return [
    bar('income', 'Receita', incomePlanned, incomeActual, 'Income'),
    bar('expense', 'Despesa', spendable, expenseActual, 'Expense'),
  ].filter((item) => item.planned > 0 || item.actual > 0)
}

export function pieConicGradient(slices: PieSlice[]): string {
  if (slices.length === 0) {
    return 'var(--surface-2)'
  }
  let cursor = 0
  const stops: string[] = []
  for (const slice of slices) {
    const next = cursor + slice.pct
    stops.push(`${slice.color} ${cursor}% ${next}%`)
    cursor = next
  }
  return `conic-gradient(${stops.join(', ')})`
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
