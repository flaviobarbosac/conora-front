import { describe, expect, it } from 'vitest'
import type { Alert } from '../api/finance'
import { alertTarget } from './alertTarget'

function alert(partial: Partial<Alert> & Pick<Alert, 'code'>): Alert {
  return {
    severity: 'Exceeded',
    message: '',
    categoryId: 'cat-1',
    percent: 120,
    ...partial,
  }
}

describe('alertTarget', () => {
  it('sends a budget overrun to Raio-X on that account', () => {
    expect(alertTarget(alert({ code: 'BUDGET_EXCEEDED', percent: 140 }), '2026-10')).toBe(
      '/raio-x?competenceYm=2026-10&categoryId=cat-1',
    )
  })

  it('sends attention and limit to Raio-X', () => {
    expect(alertTarget(alert({ code: 'BUDGET_ATTENTION', severity: 'Attention', percent: 80 }), '2026-10')).toBe(
      '/raio-x?competenceYm=2026-10&categoryId=cat-1',
    )
    expect(alertTarget(alert({ code: 'BUDGET_LIMIT', severity: 'Limit', percent: 100 }), '2026-10')).toBe(
      '/raio-x?competenceYm=2026-10&categoryId=cat-1',
    )
  })

  it('sends unplanned spend to the entries of that account', () => {
    expect(alertTarget(alert({ code: 'BUDGET_EXCEEDED', percent: null }), '2026-10')).toBe(
      '/lancamentos?competenceYm=2026-10&categoryId=cat-1',
    )
  })

  it('keeps category review, card limit, month close, and a negative month on their screens', () => {
    expect(alertTarget(alert({ code: 'CATEGORY_PENDING_REVIEW', categoryId: null, percent: null }), '2026-10')).toBe(
      '/categorias',
    )
    expect(alertTarget(alert({ code: 'MONTH_CLOSE_PENDING', categoryId: null, percent: null, severity: 'Attention' }), '2026-10')).toBe(
      '/mes',
    )
    expect(alertTarget(alert({ code: 'CARD_LIMIT', categoryId: null, percent: 110 }), '2026-10')).toBe('/cartoes')
    expect(alertTarget(alert({ code: 'NEGATIVE_RESULT', categoryId: null, percent: null, severity: 'Attention' }), '2026-10')).toBe(
      '/raio-x?competenceYm=2026-10',
    )
  })
})
