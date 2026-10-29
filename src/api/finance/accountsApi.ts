import { apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  Account,
  BankOption,
  CreateAccountInput,
  CashBalance,
} from './types'
export const accountsApi = {
  list: (includeArchived = false) => apiFetch<Account[]>(`/accounts${query({ includeArchived })}`),
  banks: () => apiFetch<BankOption[]>('/accounts/banks'),
  cashBalanceAtEndOfMonth: (endYm: string) =>
    apiFetch<CashBalance>(`/accounts/cash-balance${query({ endYm })}`),
  create: (input: CreateAccountInput) => apiFetch<Account>('/accounts', json('POST', input)),
  update: (id: string, input: CreateAccountInput) =>
    apiFetch<Account>(`/accounts/${id}`, json('PUT', input)),
  archive: (id: string, archived: boolean) =>
    apiFetch<Account>(`/accounts/${id}/archive`, json('POST', { archived })),
}
