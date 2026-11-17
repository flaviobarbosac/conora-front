import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  MonthStatus,
  SharedMonthClient,
} from './types'
export const monthsApi = {
  list: () => apiFetch<MonthStatus[]>('/months'),
  sharedWithMe: () => apiFetch<SharedMonthClient[]>('/months/shared-with-me'),
  get: (ym: string) => apiFetch<MonthStatus>(`/months/${ym}`),
  close: (ym: string) => apiFetch<MonthStatus>(`/months/${ym}/close`, json('POST')),
  reopen: (ym: string, reason: string) => apiFetch<MonthStatus>(`/months/${ym}/reopen`, json('POST', { reason })),
}
