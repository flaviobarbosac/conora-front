import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Plan, PlanOffer } from '../api/finance'
import {
  PHASE_LABEL,
  TIER_INFO,
  familyInviteLimit,
  graceScreenShown,
  markGraceScreenShown,
  planSummary,
  tierOfKind,
} from './planAccess'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  })
})

function offer(tier: PlanOffer['tier'], maxExtraMembers: number): PlanOffer {
  const kind =
    tier === 'FamilyPlus'
      ? 'FamilyPlusMonthly'
      : tier === 'Family'
        ? 'FamilyMonthly'
        : 'IndividualMonthly'
  return {
    kind,
    tier,
    yearly: false,
    price: 29.9,
    monthlyEquivalent: 29.9,
    maxExtraMembers,
  }
}

function plan(partial: Partial<Plan>): Plan {
  return {
    phase: 'Subscribed',
    daysLeft: 0,
    plan: 'IndividualMonthly',
    tier: 'Individual',
    yearly: false,
    price: 29.9,
    offers: [offer('Individual', 0), offer('Family', 1), offer('FamilyPlus', 5)],
    status: 'Active',
    expiresAt: null,
    isReadOnly: false,
    trialEndsAt: '2026-01-01',
    blockAt: '2026-01-11',
    coveredByFamily: false,
    everSubscribed: true,
    isTrainingStudent: false,
    hasFullAccess: true,
    ...partial,
  }
}

describe('planAccess', () => {
  it('maps kind to tier', () => {
    expect(tierOfKind('FamilyPlusYearly')).toBe('FamilyPlus')
    expect(tierOfKind('FamilyMonthly')).toBe('Family')
    expect(tierOfKind('IndividualMonthly')).toBe('Individual')
  })

  it('family invite limits by subscribed tier', () => {
    expect(familyInviteLimit(plan({ plan: 'FamilyMonthly', tier: 'Family' })).maxExtra).toBe(1)
    expect(
      familyInviteLimit(plan({ plan: 'FamilyPlusMonthly', tier: 'FamilyPlus' })).message,
    ).toContain('6')
    expect(
      familyInviteLimit(plan({ phase: 'Trial', plan: 'FamilyMonthly', tier: 'Family' })).maxExtra,
    ).toBe(0)
  })

  it('summarizes plan phases', () => {
    expect(planSummary(null)).toBe('Carregando…')
    expect(planSummary(plan({ phase: 'Trial', daysLeft: 12 }))).toContain('12 dias')
    expect(planSummary(plan({ phase: 'Grace' }))).toContain('somente leitura')
    expect(planSummary(plan({ phase: 'Blocked' }))).toBe('Conta bloqueada')
    expect(
      planSummary(plan({ phase: 'Subscribed', plan: 'IndividualYearly', yearly: true })),
    ).toContain(TIER_INFO.Individual.title)
    expect(planSummary(plan({ phase: 'Subscribed', plan: 'FamilyMonthly', tier: 'Family' }))).toContain(
      'Duo mensal',
    )
    expect(PHASE_LABEL.Subscribed).toBe('Ativo')
  })

  it('grace screen session flag', () => {
    expect(graceScreenShown()).toBe(false)
    markGraceScreenShown()
    expect(graceScreenShown()).toBe(true)
  })
})
