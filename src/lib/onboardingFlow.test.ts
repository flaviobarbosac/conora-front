import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_WALKTHROUGH,
  canCompleteOnboarding,
  resumeOnboardingStep,
} from './onboardingFlow'

describe('onboarding walkthrough (ponta a ponta)', () => {
  it('covers nome, telefone, e-mail, CEP, conta, cartão e vídeo na ordem', () => {
    const collected = ONBOARDING_WALKTHROUGH.flatMap((s) => s.collects)
    expect(collected).toEqual([
      'nome',
      'telefone',
      'e-mail',
      'CEP',
      'conta bancária',
      'cartão de crédito',
      'vídeo de boas-vindas',
    ])
    expect(ONBOARDING_WALKTHROUGH.map((s) => s.step)).toEqual([
      'profile',
      'account',
      'card',
      'video',
    ])
  })

  it('resumes mid-flow without locking the user out after account/card failure', () => {
    expect(
      resumeOnboardingStep({ phone: '27999999999', cep: '29000000', hasAccount: false, hasCard: false }),
    ).toBe('account')

    expect(
      resumeOnboardingStep({ phone: '27999999999', cep: '29000000', hasAccount: true, hasCard: false }),
    ).toBe('card')

    expect(
      resumeOnboardingStep({ phone: '27999999999', cep: '29000000', hasAccount: true, hasCard: true }),
    ).toBe('video')
  })

  it('persists contact into the same profile fields (no parallel cadastro)', () => {
    const profileStep = ONBOARDING_WALKTHROUGH.find((s) => s.step === 'profile')
    expect(profileStep?.persistsIn).toBe('perfil')
    const accountStep = ONBOARDING_WALKTHROUGH.find((s) => s.step === 'account')
    expect(accountStep?.persistsIn).toBe('contas')
    const cardStep = ONBOARDING_WALKTHROUGH.find((s) => s.step === 'card')
    expect(cardStep?.persistsIn).toBe('cartões')
  })

  it('only completes when phone, CEP, account and card are all present', () => {
    expect(
      canCompleteOnboarding({
        phone: '27',
        cep: '29000',
        hasAccount: true,
        hasCard: true,
      }).ok,
    ).toBe(false)

    expect(
      canCompleteOnboarding({
        phone: '27999999999',
        cep: '29000-000',
        hasAccount: true,
        hasCard: true,
      }).ok,
    ).toBe(true)
  })

  it('simulates the full happy path step by step', () => {
    let state = { phone: '', cep: '', hasAccount: false, hasCard: false }
    expect(resumeOnboardingStep(state)).toBe('profile')

    state = { ...state, phone: '27988887777', cep: '29100000' }
    expect(resumeOnboardingStep(state)).toBe('account')
    expect(canCompleteOnboarding(state).ok).toBe(false)

    state = { ...state, hasAccount: true }
    expect(resumeOnboardingStep(state)).toBe('card')
    expect(canCompleteOnboarding(state).missing).toEqual(['card'])

    state = { ...state, hasCard: true }
    expect(resumeOnboardingStep(state)).toBe('video')
    expect(canCompleteOnboarding(state).ok).toBe(true)
  })
})
