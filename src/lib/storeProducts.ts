import type { PlanKind } from '../api/finance'

/**
 * Store SKUs (App Store product id = Google Play subscription product id).
 * Must match Conora.Infrastructure.Billing.StoreProductIds and the store listings.
 */
export const STORE_PRODUCT_IDS: Partial<Record<PlanKind, string>> = {
  IndividualMonthly: 'conora.individual.monthly',
  IndividualYearly: 'conora.individual.yearly',
  FamilyMonthly: 'conora.duo.monthly',
  FamilyYearly: 'conora.duo.yearly',
  FamilyPlusMonthly: 'conora.family.monthly',
  FamilyPlusYearly: 'conora.family.yearly',
}

/** Google Play base plan id of each subscription product (one base plan per product). */
export function googleBasePlanId(productId: string): string {
  return productId.endsWith('.yearly') ? 'yearly' : 'monthly'
}

export const STORE_MANAGE_URL = {
  android: 'https://play.google.com/store/account/subscriptions?package=br.com.conora.app',
  ios: 'https://apps.apple.com/account/subscriptions',
} as const
