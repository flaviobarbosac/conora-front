/** Pure onboard resume / completion rules used by OnboardingPage and tests. */

export type OnboardingResumeInput = {
  phone: string | null | undefined
  cep: string | null | undefined
  hasAccount: boolean
  hasCard: boolean
}

export type OnboardingStep = 'profile' | 'account' | 'card' | 'video'

export function resumeOnboardingStep(input: OnboardingResumeInput): OnboardingStep {
  const phoneOk = digitsOnly(input.phone).length >= 10
  const cepOk = digitsOnly(input.cep).length === 8
  if (!phoneOk || !cepOk) return 'profile'
  if (!input.hasAccount) return 'account'
  if (!input.hasCard) return 'card'
  return 'video'
}

export function canCompleteOnboarding(input: OnboardingResumeInput): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (digitsOnly(input.phone).length < 10) missing.push('phone')
  if (digitsOnly(input.cep).length !== 8) missing.push('cep')
  if (!input.hasAccount) missing.push('account')
  if (!input.hasCard) missing.push('card')
  return { ok: missing.length === 0, missing }
}

/** Ordered walkthrough of the mandatory onboard (name/email live on profile; contact → account → card → video). */
export const ONBOARDING_WALKTHROUGH: ReadonlyArray<{
  step: OnboardingStep
  collects: string[]
  persistsIn: string
}> = [
  { step: 'profile', collects: ['nome', 'telefone', 'e-mail', 'CEP'], persistsIn: 'perfil' },
  { step: 'account', collects: ['conta bancária'], persistsIn: 'contas' },
  { step: 'card', collects: ['cartão de crédito'], persistsIn: 'cartões' },
  { step: 'video', collects: ['vídeo de boas-vindas'], persistsIn: 'onboardingCompleted' },
]

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}
