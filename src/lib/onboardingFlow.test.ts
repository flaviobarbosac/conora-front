import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_WALKTHROUGH,
  canCompleteOnboarding,
  resumeOnboardingStep,
} from './onboardingFlow'

describe('onboarding walkthrough (ponta a ponta)', () => {
  it('covers telefone, CEP, conta, diagnóstico e vídeo na ordem', () => {
    const collected = ONBOARDING_WALKTHROUGH.flatMap((s) => s.collects)
    expect(collected).toEqual([
      'telefone',
      'CEP',
      'conta bancária',
      'renda fixa',
      'parcela de dívida',
      'patrimônio',
      'projeto de vida',
      'vídeo de boas-vindas',
    ])
    expect(ONBOARDING_WALKTHROUGH.map((s) => s.step)).toEqual([
      'profile',
      'account',
      'diagnosis',
      'video',
    ])
  })

  it('resumes mid-flow without locking the user out after account failure', () => {
    expect(
      resumeOnboardingStep({ phone: '27999999999', cep: '29000000', hasAccount: false }),
    ).toBe('account')

    expect(
      resumeOnboardingStep({
        phone: '27999999999',
        cep: '29000000',
        hasAccount: true,
        hasDiagnostico: false,
      }),
    ).toBe('diagnosis')

    expect(
      resumeOnboardingStep({
        phone: '27999999999',
        cep: '29000000',
        hasAccount: true,
        hasDiagnostico: true,
      }),
    ).toBe('video')
  })

  it('persists contact into the same profile fields (no parallel cadastro)', () => {
    const profileStep = ONBOARDING_WALKTHROUGH.find((s) => s.step === 'profile')
    expect(profileStep?.persistsIn).toBe('perfil')
    const accountStep = ONBOARDING_WALKTHROUGH.find((s) => s.step === 'account')
    expect(accountStep?.persistsIn).toBe('contas')
    const diagnosisStep = ONBOARDING_WALKTHROUGH.find((s) => s.step === 'diagnosis')
    expect(diagnosisStep?.persistsIn).toBe('jornadaDiagnostico')
  })

  it('only completes when phone, CEP, account and diagnóstico are present', () => {
    expect(
      canCompleteOnboarding({
        phone: '27999999999',
        cep: '29000-000',
        hasAccount: true,
        hasDiagnostico: false,
      }).ok,
    ).toBe(false)

    expect(
      canCompleteOnboarding({
        phone: '27999999999',
        cep: '29000-000',
        hasAccount: true,
        hasDiagnostico: true,
      }).ok,
    ).toBe(true)
  })

  it('simulates the full happy path step by step', () => {
    let state = { phone: '', cep: '', hasAccount: false, hasDiagnostico: false }
    expect(resumeOnboardingStep(state)).toBe('profile')

    state = { ...state, phone: '27988887777', cep: '29100000' }
    expect(resumeOnboardingStep(state)).toBe('account')
    expect(canCompleteOnboarding(state).ok).toBe(false)

    state = { ...state, hasAccount: true }
    expect(resumeOnboardingStep(state)).toBe('diagnosis')
    expect(canCompleteOnboarding(state).ok).toBe(false)

    state = { ...state, hasDiagnostico: true }
    expect(resumeOnboardingStep(state)).toBe('video')
    expect(canCompleteOnboarding(state).ok).toBe(true)
  })
})
