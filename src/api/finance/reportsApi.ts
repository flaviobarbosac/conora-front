import { apiBlob, apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  Alert,
  Dashboard,
  MonthlyReport,
} from './types'
export const dashboardApi = {
  get: (ym: string) => apiFetch<Dashboard>(`/dashboard/${ym}`),
  alerts: (ym: string) => apiFetch<Alert[]>(`/dashboard/${ym}/alerts`),
  markAlertsSeen: (competenceYm: string, items: { code: string; categoryId?: string | null }[]) =>
    apiFetch<void>(
      '/dashboard/alerts/seen',
      json('POST', {
        competenceYm,
        items: items.map((item) => ({ code: item.code, categoryId: item.categoryId ?? null })),
      }),
    ),
  monthlyReport: (ym: string) => apiFetch<MonthlyReport>(`/reports/monthly/${ym}`),
}

export const exportApi = {
  entries: (competenceYm?: string) => apiBlob(`/export/entries${query({ competenceYm })}`),
  summary: (ym: string) => apiBlob(`/export/summary/${ym}`),
}
