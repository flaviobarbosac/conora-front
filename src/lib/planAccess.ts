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
    title: 'Família',
    tagline: 'Para a família inteira',
    people: 'Até 6 pessoas (você + 5)',
    family: 'Grupo familiar com até 6 pessoas',
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

/** Seats beyond the owner. Trial and no plan count as Individual (no invites). */
export function familyInviteLimit(plan: Plan | null | undefined): { maxExtra: number; message: string } {
  const tier = subscribedTier(plan)
  const fromOffer = tier ? plan?.offers.find((offer) => offer.tier === tier)?.maxExtraMembers : null
  const maxExtra = fromOffer ?? 0
  if (tier === 'Family') {
    return {
      maxExtra,
      message:
        'O plano Duo permite só você e mais 1 pessoa (2 no total). Para incluir mais gente, mude para o plano Família.',
    }
  }
  if (tier === 'FamilyPlus') {
    return {
      maxExtra,
      message: 'O plano Família permite você e mais 5 pessoas (6 no total).',
    }
  }
  return {
    maxExtra: 0,
    message:
      'O plano Individual é só para você. Para convidar alguém, mude para o Duo (você + 1) ou para o Família (você + 5).',
  }
}

export function tierOfKind(kind: PlanKind): PlanTier {
  if (kind.startsWith('FamilyPlus')) return 'FamilyPlus'
  if (kind.startsWith('Family')) return 'Family'
  return 'Individual'
}

/** Billing cycle from the persisted kind — never trust a detached yearly flag. */
export function isYearlyKind(kind: PlanKind): boolean {
  return kind.includes('Yearly') || kind === 'Yearly14990'
}

/** Commercial title + cycle from PlanKind (source of truth for what was signed). */
export function planKindLabel(kind: PlanKind): string {
  const tier = LEGACY_KINDS.includes(kind) ? 'Individual' : tierOfKind(kind)
  const cycle = isYearlyKind(kind) ? 'anual' : 'mensal'
  return `${TIER_INFO[tier].title} ${cycle}`
}

/** Active subscribed tier from kind; null when not on a paid personal plan. */
export function subscribedTier(plan: Plan | null | undefined): PlanTier | null {
  if (!plan || plan.phase !== 'Subscribed' || !plan.plan) return null
  if (plan.coveredByFamily) return tierOfKind(plan.plan)
  return LEGACY_KINDS.includes(plan.plan) ? 'Individual' : tierOfKind(plan.plan)
}

/** One-line summary for settings, profile and menus. Always derived from `plan.plan`. */
export function planSummary(plan: Plan | null | undefined): string {
  if (!plan) return 'Carregando…'
  if (plan.phase === 'Trial') {
    return plan.isTrainingStudent
      ? `Acesso completo gratuito · ${plan.daysLeft} dias restantes`
      : `Acesso gratuito · ${plan.daysLeft} dias restantes`
  }
  if (plan.phase === 'Grace') return 'Acesso gratuito encerrado · somente leitura'
  if (plan.phase === 'Blocked') return 'Conta bloqueada'
  if (plan.phase === 'Expired') {
    return plan.everSubscribed
      ? 'Plano vencido · Conora grátis'
      : 'Conora grátis'
  }
  if (!plan.plan) return PHASE_LABEL[plan.phase]
  const label = planKindLabel(plan.plan)
  const price = plan.price !== null ? ` · ${formatMoney(plan.price)}` : ''
  if (plan.coveredByFamily) {
    return `${label} do grupo${price} · ${PHASE_LABEL[plan.phase]}`
  }
  return `${label}${price} · ${PHASE_LABEL[plan.phase]}`
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
