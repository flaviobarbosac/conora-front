import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  PlanKind,
  Plan,
  StorePurchase,
} from './types'
export const planApi = {
  get: () => apiFetch<Plan>('/plan'),
  courseCheckout: () => apiFetch<{ checkoutUrl: string | null }>('/plan/course', { auth: false }),
  /** Development / Testing only (the API answers 404 in production). */
  subscribe: (plan: PlanKind, storePurchaseToken?: string) =>
    apiFetch<Plan>('/plan/subscribe', json('POST', { plan, storePurchaseToken })),
  /** Validates an App Store / Google Play purchase with the store and returns the updated plan. */
  confirmStore: (purchase: StorePurchase) => apiFetch<Plan>('/plan/store/confirm', json('POST', purchase)),
}
