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
  share: (ym: string) => apiFetch<void>(`/months/${ym}/share`, { method: 'POST' }),
  shared: () => apiFetch<string[]>('/months/shared'),
  unshare: (ym: string) => apiFetch<void>(`/months/${ym}/share`, { method: 'DELETE' }),
  close: (ym: string) => apiFetch<MonthStatus>(`/months/${ym}/close`, json('POST')),
  reopen: (ym: string, reason: string) => apiFetch<MonthStatus>(`/months/${ym}/reopen`, json('POST', { reason })),
}
