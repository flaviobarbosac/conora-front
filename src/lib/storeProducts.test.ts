import { describe, expect, it } from 'vitest'
import { googleBasePlanId, STORE_PRODUCT_IDS } from './storeProducts'

describe('store billing SKUs', () => {
  it('matches the backend StoreProductIds for every sellable plan', () => {
    expect(STORE_PRODUCT_IDS).toEqual({
      IndividualMonthly: 'conora.individual.monthly',
      IndividualYearly: 'conora.individual.yearly',
      FamilyMonthly: 'conora.duo.monthly',
      FamilyYearly: 'conora.duo.yearly',
      FamilyPlusMonthly: 'conora.family.monthly',
      FamilyPlusYearly: 'conora.family.yearly',
    })
  })

  it('maps each Google Play product to its single base plan', () => {
    expect(googleBasePlanId('conora.duo.yearly')).toBe('yearly')
    expect(googleBasePlanId('conora.family.monthly')).toBe('monthly')
  })
})
