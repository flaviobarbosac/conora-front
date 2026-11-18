import { apiFetch } from '../client'
import type { PendingDebt } from './types'

export const pendingDebtsApi = {
  list: () => apiFetch<PendingDebt[]>('/pending-debts'),
}
