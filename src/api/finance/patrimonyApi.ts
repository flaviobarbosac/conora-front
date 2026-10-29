import { apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  PatrimonyItem,
  PatrimonySummary,
  Reserve,
} from './types'
export const patrimonyApi = {
  get: () => apiFetch<PatrimonySummary>('/patrimony'),
  reserve: (competenceYm?: string) => apiFetch<Reserve>(`/patrimony/reserve${query({ competenceYm })}`),
  create: (categoryId: string, name: string, amount: number) =>
    apiFetch<PatrimonyItem>('/patrimony/items', json('POST', { categoryId, name, amount })),
  update: (id: string, categoryId: string, name: string, amount: number) =>
    apiFetch<PatrimonyItem>(`/patrimony/items/${id}`, json('PUT', { categoryId, name, amount })),
  remove: (id: string) => apiFetch<void>(`/patrimony/items/${id}`, json('DELETE')),
}
