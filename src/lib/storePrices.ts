/**
 * Canonical Conora store prices (BRL), on App Store price points. Yearly is the store tier
 * just above 10 monthly fees (close to 2 months free).
 * Keep in sync with Conora.Domain.Catalog.PlanCatalog and Play / App Store listings.
 */
export const STORE_PRICES = {
  Individual: { monthly: 49.9, yearly: 499.9, maxPeople: 1, storeTitle: 'Individual' },
  Duo: { monthly: 59.9, yearly: 599.9, maxPeople: 2, storeTitle: 'Duo' },
  Family: { monthly: 79.9, yearly: 799.9, maxPeople: 5, storeTitle: 'Família' },
} as const

export type StoreTierKey = keyof typeof STORE_PRICES
