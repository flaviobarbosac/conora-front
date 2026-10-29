import { describe, expect, it } from 'vitest'
import type { Category } from '../api/finance'
import {
  acceptsAnalyticalChild,
  compareCategorySections,
  compareCategorySiblings,
  isCashFlowSection,
  isPatrimonySection,
  isStructuralSection,
  sectionLabel,
} from './categoryOrder'

function cat(partial: Partial<Category>): Category {
  return {
    id: '1',
    name: 'A',
    code: null,
    level: 'Analytical',
    section: 'Essential',
    parentId: null,
    isSystem: false,
    isActive: true,
    sortOrder: 0,
    displayNumber: null,
    ...partial,
  } as Category
}

describe('categoryOrder', () => {
  it('classifies sections', () => {
    expect(isCashFlowSection('Income')).toBe(true)
    expect(isCashFlowSection('Asset')).toBe(false)
    expect(isPatrimonySection('Liability')).toBe(true)
    expect(isStructuralSection('Budget')).toBe(true)
    expect(acceptsAnalyticalChild('Essential')).toBe(true)
    expect(acceptsAnalyticalChild('Budget')).toBe(false)
  })

  it('labels every section', () => {
    expect(sectionLabel('Budget')).toBe('Orçamento')
    expect(sectionLabel('Expense')).toBe('Despesa')
    expect(sectionLabel('Debt')).toContain('Dívidas')
    expect(sectionLabel('Asset')).toBe('Ativo')
  })

  it('compares siblings and sections', () => {
    expect(compareCategorySections('Income', 'Essential')).toBeLessThan(0)
    const roots = [
      cat({ level: 'Root', section: 'Patrimony', name: 'P' }),
      cat({ level: 'Root', section: 'Budget', name: 'B' }),
    ]
    expect(compareCategorySiblings(roots[0], roots[1])).toBeGreaterThan(0)
    expect(compareCategorySiblings(cat({ name: 'Zebra' }), cat({ name: 'Alpha' }))).toBeGreaterThan(0)
  })
})
