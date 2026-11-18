import { addressReady } from './cep'

/** Pure onboard resume / completion rules used by OnboardingPage and tests. */

export type OnboardingResumeInput = {
  phone: string | null | undefined
  cep: string | null | undefined
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  municipio?: string | null
  uf?: string | null
  hasAccount: boolean
  /** Diagnostic yes/no answers saved for the Raio-X journey. */
  hasDiagnostico?: boolean
  /** Card is optional on the free-tier onboard; kept for callers that still pass it. */
  hasCard?: boolean
}

export type OnboardingStep = 'profile' | 'account' | 'diagnosis' | 'video'

export function resumeOnboardingStep(input: OnboardingResumeInput): OnboardingStep {
  const phoneOk = digitsOnly(input.phone).length >= 10
  if (!phoneOk || !addressReady(input)) return 'profile'
  if (!input.hasAccount) return 'account'
  if (!input.hasDiagnostico) return 'diagnosis'
  return 'video'
}

export function canCompleteOnboarding(input: OnboardingResumeInput): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (digitsOnly(input.phone).length < 10) missing.push('phone')
  if (!addressReady(input)) missing.push('cep')
  if (!input.hasAccount) missing.push('account')
  if (!input.hasDiagnostico) missing.push('diagnostico')
  return { ok: missing.length === 0, missing }
}

/** Ordered walkthrough: contact → bank → Ian diagnosis → welcome video. */
export const ONBOARDING_WALKTHROUGH: ReadonlyArray<{
  step: OnboardingStep
  collects: string[]
  persistsIn: string
}> = [
  { step: 'profile', collects: ['telefone', 'CEP', 'logradouro', 'número', 'bairro', 'município', 'UF'], persistsIn: 'perfil' },
  { step: 'account', collects: ['conta bancária'], persistsIn: 'contas' },
  {
    step: 'diagnosis',
    collects: ['renda fixa', 'parcela de dívida', 'patrimônio', 'projeto de vida'],
    persistsIn: 'jornadaDiagnostico',
  },
  { step: 'video', collects: ['vídeo de boas-vindas'], persistsIn: 'onboardingCompleted' },
]

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}
