import type { Alert } from '../api/finance'

/** Route where the user can act on the alert. */
export function alertTarget(alert: Alert, competenceYm: string): string {
  const ym = encodeURIComponent(competenceYm)
  const category = alert.categoryId
    ? `&categoryId=${encodeURIComponent(alert.categoryId)}`
    : ''

  if (alert.code === 'CATEGORY_PENDING_REVIEW') {
    return '/categorias'
  }
  if (alert.code === 'CARD_LIMIT') {
    return '/cartoes'
  }
  if (alert.code === 'NEGATIVE_RESULT') {
    return `/raio-x?competenceYm=${ym}`
  }
  // Spend with no plan: the entries on that account are what to review.
  if (alert.code.startsWith('BUDGET_') && alert.percent === null && alert.categoryId) {
    return `/lancamentos?competenceYm=${ym}${category}`
  }
  // Attention, limit, or overrun: Raio-X shows planned against actual.
  if (alert.code.startsWith('BUDGET_')) {
    return `/raio-x?competenceYm=${ym}${category}`
  }
  return `/raio-x?competenceYm=${ym}`
}
