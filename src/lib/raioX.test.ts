import { describe, expect, it } from 'vitest'
import type { BudgetLine, ChartAccount } from '../api/finance'
import {
  buildAmountMaps,
  groupAccountsByParent,
  sumBranch,
  variationPercent,
} from './raioX'

function account(
  partial: Pick<ChartAccount, 'id' | 'parentId' | 'name' | 'level'> & Partial<ChartAccount>,
): ChartAccount {
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
  chartAccountId: string,
  plannedAmount: number,
  actualAmount: number,
  isGroup = false,
): BudgetLine {
  return {
    chartAccountId,
    chartAccountName: chartAccountId,
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

describe('variationPercent', () => {
  it('returns percent delta of planned', () => {
    expect(variationPercent({ planned: 3000, actual: 0 })).toBeCloseTo(-100)
    expect(variationPercent({ planned: 100, actual: 150 })).toBeCloseTo(50)
  })

  it('returns 0 for zero/zero and null when actual without planned', () => {
    expect(variationPercent({ planned: 0, actual: 0 })).toBe(0)
    expect(variationPercent({ planned: 0, actual: 10 })).toBeNull()
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
