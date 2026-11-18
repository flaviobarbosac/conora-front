import { describe, expect, it } from 'vitest'
import {
  budgetOverAmount,
  sumDebtAndSurplus,
  sumNewDebt,
  topLeakages,
  topUnposted,
} from './monthClosePreview'

describe('monthClosePreview', () => {
  const gaps = [
    { categoryId: 'a', categoryName: 'INSS', openAmount: 100, alreadyRegistered: false },
    { categoryId: 'b', categoryName: 'IRRF', openAmount: 40, alreadyRegistered: false },
    { categoryId: 'c', categoryName: 'Condo', openAmount: 200, alreadyRegistered: true },
  ]

  it('splits marked debt from surplus', () => {
    expect(sumDebtAndSurplus(gaps, ['a'])).toEqual({ debtTotal: 300, surplusTotal: 40 })
  })

  it('sums only newly marked debts', () => {
    expect(sumNewDebt(gaps, ['a', 'c'])).toBe(100)
  })

  it('lists top leakages by overrun', () => {
    const rows = topLeakages(
      [
        { categoryId: '1', categoryName: 'Mercado', plannedAmount: 100, actualAmount: 250, isGroup: false },
        { categoryId: '2', categoryName: 'Lazer', plannedAmount: 50, actualAmount: 80, isGroup: false },
        { categoryId: '3', categoryName: 'Grupo', plannedAmount: 10, actualAmount: 90, isGroup: true },
        { categoryId: '4', categoryName: 'Ok', plannedAmount: 100, actualAmount: 90, isGroup: false },
      ],
      2,
    )
    expect(rows.map((row) => row.categoryName)).toEqual(['Mercado', 'Lazer'])
    expect(rows[0].overAmount).toBe(150)
  })

  it('lists unposted planned lines', () => {
    const rows = topUnposted(
      [
        { categoryId: '1', categoryName: 'INSS', plannedAmount: 800, actualAmount: 0, isGroup: false },
        { categoryId: '2', categoryName: 'Luz', plannedAmount: 120, actualAmount: 0, isGroup: false },
        { categoryId: '3', categoryName: 'Pago', plannedAmount: 50, actualAmount: 50, isGroup: false },
      ],
      5,
    )
    expect(rows.map((row) => row.categoryName)).toEqual(['INSS', 'Luz'])
  })

  it('computes budget over amount', () => {
    expect(budgetOverAmount(1000, 1300)).toBe(300)
    expect(budgetOverAmount(1000, 900)).toBe(0)
  })
})
