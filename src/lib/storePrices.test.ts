import { describe, expect, it } from 'vitest'
import { STORE_PRICES, yearlyFromMonthly } from './storePrices'

describe('store prices', () => {
  it('matches the approved catalog 49,90 / 59,90 / 79 with Family capped at 5', () => {
    expect(STORE_PRICES.Individual.monthly).toBe(49.9)
    expect(STORE_PRICES.Duo.monthly).toBe(59.9)
    expect(STORE_PRICES.Family.monthly).toBe(79)
    expect(STORE_PRICES.Family.maxPeople).toBe(5)
    expect(STORE_PRICES.Duo.maxPeople).toBe(2)
    expect(yearlyFromMonthly(59.9)).toBe(599)
    expect(yearlyFromMonthly(79)).toBe(790)
  })
})
