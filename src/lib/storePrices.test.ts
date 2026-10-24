import { describe, expect, it } from 'vitest'
import { STORE_PRICES } from './storePrices'

describe('store prices', () => {
  it('matches the App Store price points with Família capped at 5', () => {
    expect(STORE_PRICES.Individual.monthly).toBe(49.9)
    expect(STORE_PRICES.Duo.monthly).toBe(59.9)
    expect(STORE_PRICES.Family.monthly).toBe(79.9)
    expect(STORE_PRICES.Individual.yearly).toBe(499.9)
    expect(STORE_PRICES.Duo.yearly).toBe(599.9)
    expect(STORE_PRICES.Family.yearly).toBe(799.9)
    expect(STORE_PRICES.Family.maxPeople).toBe(5)
    expect(STORE_PRICES.Duo.maxPeople).toBe(2)
    expect(STORE_PRICES.Family.storeTitle).toBe('Família')
  })
})
