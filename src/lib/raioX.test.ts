import { describe, expect, it } from 'vitest'
import type { Budget, BudgetLine, Category } from '../api/finance'
import {
  aggregateYearMonths,
  buildAmountMaps,
  patrimonyStockMap,
  sectionHead,
  sectionRealized,
  groupAccountsByParent,
  monthsEndingAt,
  progressPercent,
  progressTone,
  spendableIncomeBox,
  sumBranch,
  variationPercent,
} from './raioX'

function account(
  partial: Pick<Category, 'id' | 'parentId' | 'name' | 'level'> & Partial<Category>,
): Category {
  return {
    code: null,
    displayNumber: null,
    section: 'Essential',
    isSystem: true,
    isActive: true,
    sortOrder: 0,
    acceptsPosting: partial.level === 'Analytical',
    ...partial,
  }
}

function line(
  categoryId: string,
  plannedAmount: number,
  actualAmount: number,
  isGroup = false,
): BudgetLine {
  return {
    categoryId,
    categoryName: categoryId,
    parentId: null,
    groupName: '',
    section: 'LifeProject',
    level: isGroup ? 'Group' : 'Analytical',
    plannedAmount,
    actualAmount,
    remaining: plannedAmount - actualAmount,
    percent: null,
    status: 'ok',
    isGroup,
  }
}

describe('progressPercent', () => {
  it('returns actual/planned as positive progress', () => {
    expect(progressPercent({ planned: 100, actual: 150 })).toBeCloseTo(150)
    expect(progressPercent({ planned: 100, actual: 0 })).toBeCloseTo(0)
    expect(progressPercent({ planned: 3000, actual: 1500 })).toBeCloseTo(50)
  })

  it('returns null when there is no planned base', () => {
    expect(progressPercent({ planned: 0, actual: 0 })).toBeNull()
    expect(progressPercent({ planned: 0, actual: 10 })).toBeNull()
  })

  it('variationPercent aliases progressPercent', () => {
    expect(variationPercent({ planned: 100, actual: 50 })).toBeCloseTo(50)
  })
})

describe('progressTone', () => {
  it('marks over 100 as over and up to 100 as ok', () => {
    expect(progressTone(100)).toBe('ok')
    expect(progressTone(80)).toBe('ok')
    expect(progressTone(100.1)).toBe('over')
  })

  it('marks missing planned amount as unbudgeted', () => {
    expect(progressTone(null)).toBe('unbudgeted')
    expect(progressTone(0, { planned: 0, actual: 0 })).toBe('unbudgeted')
    expect(progressTone(null, { planned: 0, actual: 50 })).toBe('unbudgeted')
  })

  it('mutes zero progress when there is a planned base', () => {
    expect(progressTone(0, { planned: 100, actual: 0 })).toBe('muted')
  })
})

describe('buildAmountMaps', () => {
  it('uses only analytical lines when present', () => {
    const maps = buildAmountMaps([
      line('group', 3000, 0, true),
      line('leaf', 3000, 0, false),
    ])
    expect(maps.planned.get('group')).toBeUndefined()
    expect(maps.planned.get('leaf')).toBe(3000)
  })

  it('aggregates duplicate analytical ids', () => {
    const maps = buildAmountMaps([line('a', 100, 10), line('a', 50, 5)])
    expect(maps.planned.get('a')).toBe(150)
    expect(maps.actual.get('a')).toBe(15)
  })
})

describe('sumBranch', () => {
  it('rolls leaf amounts to parents without double counting', () => {
    const root = account({ id: 'root', parentId: null, name: 'Projetos', level: 'Root' })
    const group = account({ id: 'short', parentId: 'root', name: 'Curto', level: 'Group' })
    const leaf = account({ id: 'reserve', parentId: 'short', name: 'Reserva', level: 'Analytical' })
    const byParent = groupAccountsByParent([root, group, leaf])
    const planned = new Map([['reserve', 3000]])
    const actual = new Map([['reserve', 0]])

    expect(sumBranch('reserve', byParent, planned, actual)).toEqual({ planned: 3000, actual: 0 })
    expect(sumBranch('short', byParent, planned, actual)).toEqual({ planned: 3000, actual: 0 })
    expect(sumBranch('root', byParent, planned, actual)).toEqual({ planned: 3000, actual: 0 })
  })

  it('sums sibling leaves', () => {
    const root = account({ id: 'root', parentId: null, name: 'Root', level: 'Root' })
    const a = account({ id: 'a', parentId: 'root', name: 'A', level: 'Analytical' })
    const b = account({ id: 'b', parentId: 'root', name: 'B', level: 'Analytical' })
    const byParent = groupAccountsByParent([root, a, b])
    const planned = new Map([
      ['a', 100],
      ['b', 150],
    ])
    const actual = new Map([
      ['a', 40],
      ['b', 10],
    ])

    expect(sumBranch('root', byParent, planned, actual)).toEqual({ planned: 250, actual: 50 })
  })
})

describe('patrimonyStockMap', () => {
  it('rolls item amounts up the category tree without a hidden balance', () => {
    const apt = account({ id: 'apt', parentId: 'use', name: 'Apartamento', level: 'Analytical' })
    const car = account({ id: 'car', parentId: 'use', name: 'Automóvel', level: 'Analytical' })
    const use = account({ id: 'use', parentId: 'asset', name: 'Bens de Uso', level: 'Group' })
    const idle = account({ id: 'idle', parentId: 'asset', name: 'Bens de Não Uso', level: 'Group' })
    const asset = account({ id: 'asset', parentId: null, name: 'Ativo', level: 'Root', section: 'Asset' })
    const byParent = groupAccountsByParent([asset, use, idle, apt, car])
    const stock = patrimonyStockMap([
      { categoryId: 'apt', amount: 850000 },
      { categoryId: 'car', amount: 120000 },
    ])

    expect(sumBranch('use', byParent, new Map(), stock)).toEqual({ planned: 0, actual: 970000 })
    expect(sumBranch('idle', byParent, new Map(), stock)).toEqual({ planned: 0, actual: 0 })
    expect(sumBranch('asset', byParent, new Map(), stock)).toEqual({ planned: 0, actual: 970000 })
  })
})

describe('sectionRealized', () => {
  it('matches the tree root and ignores planned and diagnosis net', () => {
    const salary = account({ id: 'salary', parentId: 'income', name: 'Salário', level: 'Analytical', section: 'Income' })
    const income = account({ id: 'income', parentId: null, name: 'Receita', level: 'Root', section: 'Income' })
    const inss = account({ id: 'inss', parentId: 'discount', name: 'INSS', level: 'Analytical', section: 'Discount' })
    const discount = account({ id: 'discount', parentId: null, name: 'Desconto', level: 'Root', section: 'Discount' })
    const byParent = groupAccountsByParent([income, salary, discount, inss])
    const actual = new Map([
      ['salary', 10000],
      ['inss', 1500],
    ])

    expect(sectionRealized(byParent, actual, 'Income')).toBe(10000)
    expect(sectionRealized(byParent, actual, 'Discount')).toBe(1500)
    expect(sectionRealized(byParent, actual, 'Income') - sectionRealized(byParent, actual, 'Discount')).toBe(8500)
  })

  it('finds section heads under Orçamento / Despesa masters', () => {
    const budget = account({ id: 'budget', parentId: null, name: 'Orçamento', level: 'Root', section: 'Budget' })
    const expense = account({ id: 'expense', parentId: 'budget', name: 'Despesa', level: 'Group', section: 'Expense' })
    const income = account({ id: 'income', parentId: 'budget', name: 'Receita', level: 'Group', section: 'Income' })
    const salary = account({ id: 'salary', parentId: 'income', name: 'Salário', level: 'Analytical', section: 'Income' })
    const discount = account({
      id: 'discount',
      parentId: 'expense',
      name: 'Descontos',
      level: 'Group',
      section: 'Discount',
    })
    const accounts = [budget, expense, income, salary, discount]
    expect(sectionHead(accounts, 'Income')?.id).toBe('income')
    expect(sectionHead(accounts, 'Discount')?.id).toBe('discount')
    const byParent = groupAccountsByParent(accounts)
    const actual = new Map([['salary', 500]])
    expect(sectionRealized(byParent, actual, 'Income', accounts)).toBe(500)
  })
})

describe('spendableIncomeBox', () => {
  it('subtracts discount from income for planned and actual', () => {
    const budget: Budget = {
      competenceYm: '2026-10',
      mode: 'Detailed',
      totalPlanned: 0,
      totalActual: 0,
      projectedExpense: 0,
      spendableIncome: 9999,
      receivedIncome: 4000,
      monthResult: 0,
      incomeSources: [],
      lines: [],
      sections: [
        {
          section: 'Income',
          name: 'Receita',
          plannedAmount: 5000,
          actualAmount: 4000,
          percentOfSpendable: null,
          lines: [],
        },
        {
          section: 'Discount',
          name: 'Desconto',
          plannedAmount: 500,
          actualAmount: 300,
          percentOfSpendable: null,
          lines: [],
        },
      ],
    }
    expect(spendableIncomeBox(budget)).toEqual({ planned: 4500, actual: 3700 })
  })
})

describe('monthsEndingAt', () => {
  it('lists inclusive months ending at the competence', () => {
    expect(monthsEndingAt('2026-10', 1)).toEqual(['2026-10'])
    expect(monthsEndingAt('2026-10', 2)).toEqual(['2026-09', '2026-10'])
    expect(monthsEndingAt('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})

describe('aggregateYearMonths', () => {
  it('sums cells for selected months only', () => {
    const maps = aggregateYearMonths(
      [
        {
          year: 2026,
          months: ['2026-01', '2026-02'],
          lines: [
            {
              categoryId: 'a',
              categoryName: 'A',
              groupName: '',
              section: 'Essential',
              months: [
                { competenceYm: '2026-01', plannedAmount: 100, actualAmount: 40 },
                { competenceYm: '2026-02', plannedAmount: 50, actualAmount: 10 },
              ],
            },
          ],
          totals: [],
        },
      ],
      ['2026-01', '2026-02'],
    )
    expect(maps.planned.get('a')).toBe(150)
    expect(maps.actual.get('a')).toBe(50)
  })
})
