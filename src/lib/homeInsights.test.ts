import { describe, expect, it } from 'vitest'
import type { Budget, BudgetSectionBlock, CategorySection, PatrimonySummary } from '../api/finance'
import type { BudgetLine } from '../api/finance'
import {
  buildBudgetMacroBars,
  buildExpensePieSlices,
  buildIncomeExpenseCompare,
  buildIncomePieSlices,
  buildPatrimonyHomeInsight,
  buildPatrimonyMacroBars,
  buildRaioXHomeInsight,
  pieConicGradient,
  pickTopDeviation,
} from './homeInsights'

function budgetLine(
  partial: Pick<BudgetLine, 'categoryId' | 'categoryName' | 'section' | 'plannedAmount' | 'actualAmount'> &
    Partial<BudgetLine>,
): BudgetLine {
  return {
    parentId: null,
    groupName: '',
    level: 'Analytical',
    remaining: 0,
    percent: null,
    status: 'ok',
    isGroup: false,
    ...partial,
  }
}

function section(
  name: string,
  plannedAmount: number,
  actualAmount: number,
  categorySection: CategorySection = 'Essential',
): BudgetSectionBlock {
  return {
    section: categorySection,
    name,
    plannedAmount,
    actualAmount,
    percentOfSpendable: null,
    lines: [],
  }
}

function budget(partial: Partial<Budget> & Pick<Budget, 'totalPlanned' | 'totalActual' | 'sections'>): Budget {
  return {
    competenceYm: '2026-10',
    mode: 'Detailed',
    projectedExpense: 0,
    spendableIncome: 0,
    receivedIncome: 0,
    monthResult: 0,
    incomeSources: [],
    lines: [],
    ...partial,
  }
}

describe('pickTopDeviation', () => {
  it('picks the section farthest from 100% progress', () => {
    const top = pickTopDeviation([
      section('Essencial', 1000, 900),
      section('Social', 100, 300),
      section('Desconto', 0, 50),
    ])
    expect(top?.name).toBe('Social')
    expect(top?.percent).toBeCloseTo(300)
  })

  it('ignores sections without planned amount', () => {
    expect(pickTopDeviation([section('X', 0, 10)])).toBeNull()
  })
})

describe('buildRaioXHomeInsight', () => {
  it('computes month percent and top deviation', () => {
    const insight = buildRaioXHomeInsight(
      budget({
        totalPlanned: 200,
        totalActual: 50,
        spendableIncome: 5000,
        receivedIncome: 1000,
        sections: [section('Projetos de vida / Investimentos', 100, 0), section('Desconto', 100, 50)],
      }),
    )
    expect(insight.monthPercent).toBeCloseTo(25)
    expect(insight.topDeviation?.name).toBe('Projetos de vida / Investimentos')
    expect(insight.topDeviation?.percent).toBeCloseTo(0)
  })

  it('computes spendable as received income minus discount actual', () => {
    const insight = buildRaioXHomeInsight(
      budget({
        totalPlanned: 5200,
        totalActual: 1100,
        spendableIncome: 9999,
        receivedIncome: 1000,
        sections: [
          section('Receita', 5000, 1000, 'Income'),
          section('Desconto', 200, 100, 'Discount'),
        ],
      }),
    )
    expect(insight.spendable).toBeCloseTo(900)
  })

  it('returns Sem orçamento signal via null monthPercent', () => {
    const insight = buildRaioXHomeInsight(
      budget({ totalPlanned: 0, totalActual: 0, sections: [] }),
    )
    expect(insight.monthPercent).toBeNull()
  })
})

describe('buildPatrimonyHomeInsight', () => {
  it('exposes net worth and asset/liability totals', () => {
    const summary: PatrimonySummary = {
      accountsBalance: 1000,
      assetsTotal: 5000,
      assetsInUse: 2000,
      assetsNotInUse: 2000,
      unpaidCardInvoices: 100,
      liabilitiesTotal: 1500,
      netWorth: 3500,
      groups: [],
      items: [],
    }
    expect(buildPatrimonyHomeInsight(summary)).toEqual({
      netWorth: 3500,
      assetsTotal: 5000,
      liabilitiesTotal: 1500,
    })
  })
})

describe('buildBudgetMacroBars', () => {
  it('builds one progress bar per cash-flow section with data', () => {
    const bars = buildBudgetMacroBars(
      budget({
        totalPlanned: 300,
        totalActual: 150,
        sections: [
          section('Ativo', 999, 999, 'Asset'),
          section('Essencial', 100, 50, 'Essential'),
          section('Receita', 200, 100, 'Income'),
        ],
      }),
    )
    expect(bars.map((bar) => bar.section)).toEqual(['Income', 'Essential'])
    expect(bars[0]?.progressPct).toBe(50)
    expect(bars[1]?.progressPct).toBe(50)
    expect(bars[0]?.tone).toBe('ok')
  })
})

describe('buildPatrimonyMacroBars', () => {
  it('scales ativo and passivo to the larger total', () => {
    const bars = buildPatrimonyMacroBars({
      accountsBalance: 0,
      assetsTotal: 800,
      assetsInUse: 0,
      assetsNotInUse: 0,
      unpaidCardInvoices: 0,
      liabilitiesTotal: 200,
      netWorth: 600,
      groups: [],
      items: [],
    })
    expect(bars[0]).toMatchObject({ key: 'assets', pct: 100 })
    expect(bars[1]).toMatchObject({ key: 'liabilities', pct: 25 })
  })
})

describe('home realized pies and compare', () => {
  it('builds income pie slices from analytical lines', () => {
    const slices = buildIncomePieSlices(
      budget({
        totalPlanned: 0,
        totalActual: 300,
        lines: [
          budgetLine({
            categoryId: 'a',
            categoryName: 'Salário',
            section: 'Income',
            plannedAmount: 0,
            actualAmount: 200,
          }),
          budgetLine({
            categoryId: 'b',
            categoryName: 'Extra',
            section: 'Income',
            plannedAmount: 0,
            actualAmount: 100,
          }),
          budgetLine({
            categoryId: 'c',
            categoryName: 'Aluguel',
            section: 'Essential',
            plannedAmount: 0,
            actualAmount: 50,
          }),
        ],
        sections: [],
      }),
    )
    expect(slices).toHaveLength(2)
    expect(slices[0]?.label).toBe('Salário')
    expect(slices[0]?.pct).toBeCloseTo((200 / 300) * 100)
    expect(pieConicGradient(slices)).toContain('conic-gradient')
  })

  it('builds expense pie from expense sections', () => {
    const slices = buildExpensePieSlices(
      budget({
        totalPlanned: 0,
        totalActual: 300,
        sections: [
          section('Descontos', 0, 50, 'Discount'),
          section('Essencial', 0, 150, 'Essential'),
          section('Social', 0, 100, 'Social'),
          section('Receita', 0, 999, 'Income'),
        ],
      }),
    )
    expect(slices.map((slice) => slice.section)).toEqual(['Discount', 'Essential', 'Social'])
    expect(slices.find((slice) => slice.section === 'Essential')?.pct).toBeCloseTo(50)
  })

  it('builds despesa as realized expenses over spendable income', () => {
    const bars = buildIncomeExpenseCompare(
      budget({
        totalPlanned: 2500,
        totalActual: 1500,
        receivedIncome: 1000,
        sections: [
          section('Receita', 2000, 1000, 'Income'),
          section('Descontos', 100, 100, 'Discount'),
          section('Essencial', 400, 400, 'Essential'),
          section('Social', 100, 100, 'Social'),
        ],
      }),
    )
    // Receita: 1000 / 2000 = 50%
    expect(bars[0]).toMatchObject({ key: 'income', planned: 2000, actual: 1000, progressPct: 50 })
    // Despesa: (100+400+100) / renda gastável (1000-100) = 600/900 = 66.6…%
    expect(bars[1]).toMatchObject({ key: 'expense', planned: 900, actual: 600 })
    expect(bars[1]?.progressPct).toBeCloseTo((600 / 900) * 100)
  })
})
