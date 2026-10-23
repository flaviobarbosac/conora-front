/**
 * Canonical Conora store prices (monthly). Yearly = 10× monthly (2 months free).
 * Keep in sync with Conora.Domain.Catalog.PlanCatalog and Play / App Store listings.
 */
export const STORE_PRICES = {
  Individual: { monthly: 49.9, maxPeople: 1, storeTitle: 'Individual' },
  Duo: { monthly: 59.9, maxPeople: 2, storeTitle: 'Duo' },
  Family: { monthly: 79, maxPeople: 5, storeTitle: 'Family' },
} as const

export type StoreTierKey = keyof typeof STORE_PRICES

export function yearlyFromMonthly(monthly: number): number {
  return Math.round(monthly * 10 * 100) / 100
}
