import { apiFetch } from '../client'
import { json, query } from './helpers'
import type {
  ConsoleKpis,
  ConsoleUserAccess,
  JourneyAbandonmentRow,
} from './types'
export const consoleApi = {
  kpis: () => apiFetch<ConsoleKpis>('/console/kpis'),
  abandonment: () => apiFetch<JourneyAbandonmentRow[]>('/console/abandonment'),
  searchUsers: (term: string) =>
    apiFetch<ConsoleUserAccess[]>(`/console/users${query({ term })}`),
  setTrialEnd: (id: string, endsOn: string) =>
    apiFetch<ConsoleUserAccess>(`/console/users/${id}/trial-end`, json('POST', { endsOn })),
  setGrant: (id: string, indefinite: boolean, until: string | null) =>
    apiFetch<ConsoleUserAccess>(`/console/users/${id}/grant`, json('POST', { indefinite, until })),
  clearGrant: (id: string) =>
    apiFetch<ConsoleUserAccess>(`/console/users/${id}/grant`, json('DELETE')),
}
