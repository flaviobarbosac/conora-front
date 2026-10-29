import { apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  BudgetMode,
  SharingScope,
  Budget,
  CategoryMemberBreakdown,
  BudgetYear,
} from './types'
export const budgetsApi = {
  get: (ym: string, scope?: SharingScope) =>
    apiFetch<Budget>(`/budgets/${ym}${query({ scope })}`),
  breakdown: (ym: string, categoryId: string, scope?: SharingScope) =>
    apiFetch<CategoryMemberBreakdown>(`/budgets/${ym}/breakdown/${categoryId}${query({ scope })}`),
  getYear: (year: number, scope?: SharingScope) =>
    apiFetch<BudgetYear>(`/budgets/year/${year}${query({ scope })}`),
  upsert: (
    ym: string,
    mode: BudgetMode,
    lines: { categoryId: string; plannedAmount: number; expenseDay?: number | null }[],
    scope?: SharingScope,
  ) => apiFetch<Budget>(`/budgets/${ym}${query({ scope })}`, json('PUT', { mode, lines })),
  copyPrevious: (ym: string, overwrite = false) =>
    apiFetch<Budget>(`/budgets/${ym}/copy-previous`, json('POST', { overwrite })),
  repeat: (
    ym: string,
    categoryId: string,
    monthCount: number,
    overwrite = false,
    plannedAmount?: number,
  ) =>
    apiFetch<Budget>(
      `/budgets/${ym}/repeat`,
      json('POST', { categoryId, monthCount, overwrite, plannedAmount }),
    ),
  installments: (
    ym: string,
    categoryId: string,
    totalAmount: number,
    installmentCount: number,
    overwrite = false,
  ) =>
    apiFetch<Budget>(
      `/budgets/${ym}/installments`,
      json('POST', { categoryId, totalAmount, installmentCount, overwrite }),
    ),
  removeLine: (ym: string, categoryId: string) =>
    apiFetch<void>(`/budgets/${ym}/lines/${categoryId}`, json('DELETE')),
}
