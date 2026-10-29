import type { Category, Plan } from '../api/finance'

/** Analytical codes unlocked on the free product (see FreeTierLimits on the API). */
export const FREE_TIER_CATEGORY_CODES = [
  'ESS_RENT',
  'ESS_POWER',
  'ESS_WATER',
  'ESS_SCHOOL',
  'INC_SALARY',
] as const

export type FreeTierCategoryCode = (typeof FREE_TIER_CATEGORY_CODES)[number]

export const FREE_TIER_CATEGORY_LABEL =
  'No Conora grátis: Salário bruto, Aluguel, Energia elétrica, Água e esgoto e Escola. Assine para liberar as demais.'

/** Shown on the entry form when Income has no writable free-tier categories. */
export const FREE_TIER_INCOME_ENTRY_HINT =
  'No plano gratuito a renda liberada é só Salário bruto. Assine para as demais receitas.'

export const PAID_MODULE_BADGE = 'Liberado nos planos pagos'

/** Compact lock hint for dense mobile lists (budget / category trees). */
export const PAID_MODULE_HINT_SHORT = 'Plano pago'

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

/**
 * Free plan chart: keep unlocked analytical leaves (+ pending review) and their
 * ancestors only — hide locked paid categories so the tree stays clean.
 */
export function freeTierVisibleIds(list: Category[]): Set<string> {
  const byId = new Map(list.map((account) => [account.id, account]))
  const visible = new Set<string>()
  for (const account of list) {
    if (!isFreeCategoryCode(account.code) && !account.isPendingReview) {
      continue
    }
    let current: Category | undefined = account
    while (current) {
      visible.add(current.id)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
  }
  return visible
}

/** Full chart when plan has full access; otherwise free-tier leaves + ancestors. */
export function filterCategoriesForPlan(
  list: Category[],
  plan: Plan | null | undefined,
  options?: { keepPendingReview?: boolean },
): Category[] {
  if (hasFullAccess(plan)) {
    return list
  }
  if (options?.keepPendingReview === false) {
    const keep = new Set<string>()
    const byId = new Map(list.map((account) => [account.id, account]))
    for (const account of list) {
      if (!isFreeCategoryCode(account.code)) {
        continue
      }
      let current: Category | undefined = account
      while (current) {
        keep.add(current.id)
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
    }
    return list.filter((account) => keep.has(account.id))
  }
  const keep = freeTierVisibleIds(list)
  return list.filter((account) => keep.has(account.id))
}

/** Ever had a store/plan row → renew; otherwise first subscribe. */
export function planCtaLabel(plan: Plan | null | undefined): 'Assinar plano' | 'Renovar plano' {
  return plan?.everSubscribed ? 'Renovar plano' : 'Assinar plano'
}
