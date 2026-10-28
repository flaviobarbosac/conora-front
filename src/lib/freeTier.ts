import type { Category, Plan } from '../api/finance'

/** Analytical expense codes unlocked on the free product (see FreeTierLimits on the API). */
export const FREE_TIER_CATEGORY_CODES = ['ESS_RENT', 'ESS_POWER', 'ESS_WATER', 'ESS_SCHOOL'] as const

export type FreeTierCategoryCode = (typeof FREE_TIER_CATEGORY_CODES)[number]

export const FREE_TIER_CATEGORY_LABEL =
  'No Conora grátis você começa com Aluguel, Energia elétrica, Água e esgoto e Escola. As outras categorias aparecem em cinza até você assinar.'

export const PAID_MODULE_BADGE = 'Liberado nos planos pagos'

/** Full product: training-student trial or paid subscription. */
export function hasFullAccess(plan: Plan | null | undefined): boolean {
  if (!plan) return false
  if (plan.hasFullAccess === true) return true
  if (plan.hasFullAccess === false) return false
  return plan.phase === 'Subscribed' || (plan.isTrainingStudent === true && plan.phase === 'Trial')
}

export function isFreeLimited(plan: Plan | null | undefined): boolean {
  return Boolean(plan) && !hasFullAccess(plan) && plan?.phase !== 'Blocked'
}

export function isFreeCategoryCode(code: string | null | undefined): boolean {
  if (!code) return false
  return (FREE_TIER_CATEGORY_CODES as readonly string[]).includes(code.trim().toUpperCase())
}

export function isCategoryWritable(plan: Plan | null | undefined, category: Pick<Category, 'code'> | null | undefined): boolean {
  if (hasFullAccess(plan)) return true
  return isFreeCategoryCode(category?.code)
}

/** Ever had a store/plan row → renew; otherwise first subscribe. */
export function planCtaLabel(plan: Plan | null | undefined): 'Assinar plano' | 'Renovar plano' {
  return plan?.everSubscribed ? 'Renovar plano' : 'Assinar plano'
}
