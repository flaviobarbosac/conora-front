import { describe, expect, it } from 'vitest'
import type { Budget, BudgetSectionBlock, PatrimonySummary } from '../api/finance'
import { buildPatrimonyHomeInsight, buildRaioXHomeInsight, pickTopDeviation } from './homeInsights'

function section(
  name: string,
  plannedAmount: number,
  actualAmount: number,
): BudgetSectionBlock {
  return {
    section: 'Essential',
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
  it('picks the largest absolute section deviation', () => {
    const top = pickTopDeviation([
      section('Essencial', 1000, 900),
      section('Social', 100, 300),
      section('Desconto', 0, 50),
    ])
    expect(top?.name).toBe('Social')
    expect(top?.percent).toBeCloseTo(200)
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
    expect(insight.topDeviation?.percent).toBeCloseTo(-100)
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
