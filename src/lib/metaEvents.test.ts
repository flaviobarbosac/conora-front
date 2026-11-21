import { beforeEach, describe, expect, it, vi } from 'vitest'

const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn(() => Promise.resolve({ logged: true })) }))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'ios'),
  },
  registerPlugin: vi.fn(() => ({ logEvent })),
}))

import { Capacitor } from '@capacitor/core'
import {
  logCompleteRegistration,
  logNewMilestones,
  logSubscriptionConfirmed,
  MILESTONE_FRESH_MS,
  newlyEarnedMilestones,
} from './metaEvents'

const NOW = Date.parse('2026-11-19T12:00:00Z')

describe('newlyEarnedMilestones', () => {
  it('returns recent earned milestones not seen yet', () => {
    const recent = new Date(NOW - 60_000).toISOString()
    const old = new Date(NOW - MILESTONE_FRESH_MS - 1).toISOString()
    const result = newlyEarnedMilestones(
      [
        { key: 'a', earned: true, earnedAt: recent },
        { key: 'b', earned: true, earnedAt: old },
        { key: 'c', earned: false, earnedAt: null },
        { key: 'd', earned: true, earnedAt: recent },
      ],
      new Set(['d']),
      NOW,
    )
    expect(result.fresh).toEqual(['a'])
    expect(result.seenNext.sort()).toEqual(['a', 'b', 'd'])
  })
})

describe('meta events', () => {
  beforeEach(() => {
    logEvent.mockClear()
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
  })

  it('logs registration once per account', () => {
    logCompleteRegistration('u1', 'google')
    logCompleteRegistration('u1', 'google')
    expect(logEvent).toHaveBeenCalledTimes(1)
    expect(logEvent).toHaveBeenCalledWith({
      name: 'fb_mobile_complete_registration',
      params: { fb_registration_method: 'google' },
      valueToSum: undefined,
    })
  })

  it('logs each milestone once', () => {
    const items = [{ key: 'primeiro_mes', earned: true, earnedAt: new Date().toISOString() }]
    logNewMilestones('u1', items)
    logNewMilestones('u1', items)
    expect(logEvent).toHaveBeenCalledTimes(1)
    expect(logEvent).toHaveBeenCalledWith({
      name: 'milestone_achieved',
      params: { milestone_id: 'primeiro_mes' },
      valueToSum: undefined,
    })
  })

  it('logs confirmed subscription with BRL value', () => {
    logSubscriptionConfirmed({ kind: 'IndividualMonthly', tier: 'Individual', yearly: false, price: 14.9 })
    expect(logEvent).toHaveBeenCalledWith({
      name: 'subscription_confirmed',
      params: { plan: 'IndividualMonthly', tier: 'Individual', cycle: 'monthly', fb_currency: 'BRL' },
      valueToSum: 14.9,
    })
  })

  it('is a no-op on web', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    logCompleteRegistration('u2')
    logSubscriptionConfirmed({ kind: 'IndividualMonthly', tier: 'Individual', yearly: false, price: 14.9 })
    expect(logEvent).not.toHaveBeenCalled()
  })
})
