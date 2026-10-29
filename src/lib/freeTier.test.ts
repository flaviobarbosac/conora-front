import { describe, expect, it } from 'vitest'
import type { Plan } from '../api/finance'
import type { Category } from '../api/finance'
import {
  FREE_TIER_CATEGORY_CODES,
  filterCategoriesForPlan,
  hasFullAccess,
  isCategoryWritable,
  isFreeCategoryCode,
  isFreeLimited,
  planCtaLabel,
} from './freeTier'

function plan(partial: Partial<Plan>): Plan {
  return {
    phase: 'Trial',
    daysLeft: 10,
    plan: null,
    tier: null,
    yearly: false,
    price: null,
    offers: [],
    status: 'Expired',
    expiresAt: null,
    isReadOnly: false,
    trialEndsAt: '2026-12-01',
    blockAt: '2026-12-11',
    coveredByFamily: false,
    everSubscribed: false,
    isTrainingStudent: false,
    hasFullAccess: false,
    ...partial,
  }
}

describe('freeTier', () => {
  it('detects free category codes case-insensitively', () => {
    expect(isFreeCategoryCode('ess_rent')).toBe(true)
    expect(isFreeCategoryCode('INC_SALARY')).toBe(true)
    expect(isFreeCategoryCode('OTHER')).toBe(false)
    expect(isFreeCategoryCode(null)).toBe(false)
    expect(FREE_TIER_CATEGORY_CODES).toHaveLength(5)
  })

  it('hasFullAccess respects flag and phases', () => {
    expect(hasFullAccess(null)).toBe(false)
    expect(hasFullAccess(plan({ hasFullAccess: true }))).toBe(true)
    expect(hasFullAccess(plan({ hasFullAccess: false, phase: 'Subscribed' }))).toBe(false)
    expect(hasFullAccess(plan({ hasFullAccess: undefined as never, phase: 'Subscribed' }))).toBe(true)
    expect(
      hasFullAccess(plan({ hasFullAccess: undefined as never, phase: 'Trial', isTrainingStudent: true })),
    ).toBe(true)
  })

  it('isFreeLimited and writable category', () => {
    expect(isFreeLimited(plan({ phase: 'Expired', hasFullAccess: false }))).toBe(true)
    expect(isFreeLimited(plan({ phase: 'Blocked', hasFullAccess: false }))).toBe(false)
    expect(isCategoryWritable(plan({ hasFullAccess: true }), { code: 'X' })).toBe(true)
    expect(isCategoryWritable(plan({ hasFullAccess: false }), { code: 'ESS_RENT' })).toBe(true)
    expect(isCategoryWritable(plan({ hasFullAccess: false }), { code: 'X' })).toBe(false)
  })

  it('plan CTA label', () => {
    expect(planCtaLabel(plan({ everSubscribed: false }))).toBe('Assinar plano')
    expect(planCtaLabel(plan({ everSubscribed: true }))).toBe('Renovar plano')
  })

  it('filterCategoriesForPlan keeps free leaves and ancestors only', () => {
    const root: Category = {
      id: 'r',
      parentId: null,
      name: 'Despesa',
      code: 'EXPENSE',
      displayNumber: '1',
      level: 'Root',
      section: 'Expense',
      isSystem: true,
      isActive: true,
      sortOrder: 0,
      acceptsPosting: false,
      sharingScope: 'Family',
    }
    const group: Category = {
      ...root,
      id: 'g',
      parentId: 'r',
      name: 'Essencial',
      code: 'ESS',
      level: 'Group',
      section: 'Essential',
    }
    const freeLeaf: Category = {
      ...root,
      id: 'f',
      parentId: 'g',
      name: 'Aluguel',
      code: 'ESS_RENT',
      level: 'Analytical',
      section: 'Essential',
      acceptsPosting: true,
    }
    const paidLeaf: Category = {
      ...freeLeaf,
      id: 'p',
      name: 'Outro',
      code: 'ESS_OTHER',
    }
    const list = [root, group, freeLeaf, paidLeaf]
    expect(filterCategoriesForPlan(list, plan({ hasFullAccess: true })).map((a) => a.id)).toEqual([
      'r',
      'g',
      'f',
      'p',
    ])
    expect(
      filterCategoriesForPlan(list, plan({ hasFullAccess: false }), { keepPendingReview: false }).map(
        (a) => a.id,
      ),
    ).toEqual(['r', 'g', 'f'])
  })
})
