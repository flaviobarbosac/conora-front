/** @deprecated Prefer onboardingFlow.test.ts — kept as alias suite. */
import { describe, expect, it } from 'vitest'
import { canCompleteOnboarding } from './onboardingFlow'

describe('onboarding completion gate', () => {
  it('blocks when phone, cep, account or card is missing', () => {
    expect(
      canCompleteOnboarding({ phone: null, cep: null, hasAccount: false, hasCard: false }).missing,
    ).toEqual(['phone', 'cep', 'account', 'card'])
  })

  it('allows when contact, account and card are present', () => {
    expect(
      canCompleteOnboarding({
        phone: '27999999999',
        cep: '29000-000',
        hasAccount: true,
        hasCard: true,
      }).ok,
    ).toBe(true)
  })

  it('keeps the user able to retry after an account/card failure (gate stays open)', () => {
    const afterAccountFail = canCompleteOnboarding({
      phone: '27999999999',
      cep: '29000000',
      hasAccount: false,
      hasCard: false,
    })
    expect(afterAccountFail.ok).toBe(false)
    expect(afterAccountFail.missing).toContain('account')
    expect(afterAccountFail.missing).not.toContain('phone')
  })
})
