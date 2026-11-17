/**
 * Canonical Conora store prices (BRL).
 * Keep in sync with Conora.Domain.Catalog.PlanCatalog and Play / App Store listings.
 */
export const STORE_PRICES = {
  Individual: { monthly: 29.9, yearly: 299.9, maxPeople: 1, storeTitle: 'Individual' },
  Duo: { monthly: 39.9, yearly: 399.9, maxPeople: 2, storeTitle: 'Duo' },
  Family: { monthly: 49.9, yearly: 499.9, maxPeople: 5, storeTitle: 'Família' },
} as const

export type StoreTierKey = keyof typeof STORE_PRICES
