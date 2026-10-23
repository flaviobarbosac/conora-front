import type { AccessPhase, Plan, PlanKind, PlanTier } from '../api/finance'
import { formatMoney } from './format'

/** Fired after a subscription changes so the access gate reloads. */
export const PLAN_CHANGED = 'conora:plan-changed'

const GRACE_SHOWN_KEY = 'conora:grace-plans-shown'

export const TRIAL_DAYS = 90
export const READ_ONLY_UNTIL_DAY = 100

export type TierInfo = {
  title: string
  tagline: string
  people: string
  family: string | null
}

export const TIER_INFO: Record<PlanTier, TierInfo> = {
  Individual: {
    title: 'Individual',
    tagline: 'Para organizar a sua vida financeira',
    people: 'Só você',
    family: null,
  },
  Family: {
    title: 'Duo',
    tagline: 'Para duas pessoas',
    people: 'Você + 1 pessoa',
    family: 'Grupo familiar com duas pessoas',
  },
  FamilyPlus: {
    title: 'Family',
    tagline: 'Para a família inteira',
    people: 'Você + 3 pessoas ou mais',
    family: 'Grupo familiar com 3 pessoas ou mais',
  },
}

export const PHASE_LABEL: Record<AccessPhase, string> = {
  Trial: 'Acesso gratuito',
  Subscribed: 'Ativo',
  Grace: 'Somente leitura',
  Expired: 'Vencido',
  Blocked: 'Bloqueada',
}

const LEGACY_KINDS: ReadonlyArray<PlanKind> = ['Monthly1490', 'Yearly14990']

export function tierOfKind(kind: PlanKind): PlanTier {
  if (kind.startsWith('FamilyPlus')) return 'FamilyPlus'
  if (kind.startsWith('Family')) return 'Family'
  return 'Individual'
}

/** One-line summary for settings and menus. */
export function planSummary(plan: Plan | null | undefined): string {
  if (!plan) return 'Carregando…'
  if (plan.phase === 'Trial') return `Acesso gratuito · ${plan.daysLeft} dias restantes`
  if (plan.phase === 'Grace') return 'Acesso gratuito encerrado · somente leitura'
  if (plan.phase === 'Blocked') return 'Conta bloqueada'
  if (!plan.plan) return PHASE_LABEL[plan.phase]
  const tier = LEGACY_KINDS.includes(plan.plan) ? 'Individual' : (plan.tier ?? 'Individual')
  const cycle = plan.yearly ? 'anual' : 'mensal'
  const price = plan.price !== null ? ` · ${formatMoney(plan.price)}` : ''
  return `${TIER_INFO[tier].title} ${cycle}${price} · ${PHASE_LABEL[plan.phase]}`
}

export function graceScreenShown(): boolean {
  try {
    return sessionStorage.getItem(GRACE_SHOWN_KEY) === '1'
  } catch {
    return true
  }
}

export function markGraceScreenShown() {
  try {
    sessionStorage.setItem(GRACE_SHOWN_KEY, '1')
  } catch {
    // Storage unavailable: the gate already treats this as shown.
  }
}
