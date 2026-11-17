import { describe, expect, it } from 'vitest'
import { STORE_PRICES } from './storePrices'

describe('store prices', () => {
  it('matches the App Store price points with Família capped at 5', () => {
    expect(STORE_PRICES.Individual.monthly).toBe(29.9)
    expect(STORE_PRICES.Duo.monthly).toBe(39.9)
    expect(STORE_PRICES.Family.monthly).toBe(49.9)
    expect(STORE_PRICES.Individual.yearly).toBe(299)
    expect(STORE_PRICES.Duo.yearly).toBe(399)
    expect(STORE_PRICES.Family.yearly).toBe(499)
    expect(STORE_PRICES.Family.maxPeople).toBe(5)
    expect(STORE_PRICES.Duo.maxPeople).toBe(2)
    expect(STORE_PRICES.Family.storeTitle).toBe('Família')
  })
})
