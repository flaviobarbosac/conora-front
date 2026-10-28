/** Pure onboard resume / completion rules used by OnboardingPage and tests. */

export type OnboardingResumeInput = {
  phone: string | null | undefined
  cep: string | null | undefined
  hasAccount: boolean
  /** Card is optional on the free-tier onboard; kept for callers that still pass it. */
  hasCard?: boolean
}

export type OnboardingStep = 'profile' | 'account' | 'video'

export function resumeOnboardingStep(input: OnboardingResumeInput): OnboardingStep {
  const phoneOk = digitsOnly(input.phone).length >= 10
  const cepOk = digitsOnly(input.cep).length === 8
  if (!phoneOk || !cepOk) return 'profile'
  if (!input.hasAccount) return 'account'
  return 'video'
}

export function canCompleteOnboarding(input: OnboardingResumeInput): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (digitsOnly(input.phone).length < 10) missing.push('phone')
  if (digitsOnly(input.cep).length !== 8) missing.push('cep')
  if (!input.hasAccount) missing.push('account')
  return { ok: missing.length === 0, missing }
}

/** Ordered walkthrough: contact → bank account (for launches) → welcome video. Card is optional later. */
export const ONBOARDING_WALKTHROUGH: ReadonlyArray<{
  step: OnboardingStep
  collects: string[]
  persistsIn: string
}> = [
  { step: 'profile', collects: ['nome', 'telefone', 'e-mail', 'CEP'], persistsIn: 'perfil' },
  { step: 'account', collects: ['conta bancária'], persistsIn: 'contas' },
  { step: 'video', collects: ['vídeo de boas-vindas'], persistsIn: 'onboardingCompleted' },
]

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}
