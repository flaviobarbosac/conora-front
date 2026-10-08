import type { Alert } from '../api/finance'

/** Route where the user can act on the alert. */
export function alertTarget(alert: Alert, competenceYm: string): string {
  if (alert.code === 'CARD_LIMIT') {
    return '/cartoes'
  }
  if (alert.code === 'NEGATIVE_RESULT') {
    return `/raio-x?competenceYm=${encodeURIComponent(competenceYm)}`
  }
  if (alert.code.startsWith('BUDGET_') && alert.chartAccountId) {
    return `/lancamentos?competenceYm=${encodeURIComponent(competenceYm)}&chartAccountId=${encodeURIComponent(alert.chartAccountId)}`
  }
  return `/raio-x?competenceYm=${encodeURIComponent(competenceYm)}`
}
