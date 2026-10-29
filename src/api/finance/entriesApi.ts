import { apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  Paged,
  Entry,
  EntryInput,
  EntryUpdateInput,
  EntryFilter,
} from './types'
export const entriesApi = {
  list: (filter: EntryFilter) => apiFetch<Paged<Entry>>(`/entries${query({ ...filter })}`),
  get: (id: string) => apiFetch<Entry>(`/entries/${id}`),
  create: (input: EntryInput) => apiFetch<Entry[]>('/entries', json('POST', input)),
  update: (id: string, input: EntryUpdateInput) => apiFetch<Entry>(`/entries/${id}`, json('PUT', input)),
  remove: (id: string) => apiFetch<void>(`/entries/${id}`, json('DELETE')),
  duplicate: (id: string) => apiFetch<Entry[]>(`/entries/${id}/duplicate`, json('POST')),
  suggestAccount: (description: string) =>
    apiFetch<{ categoryId: string | null; categoryName: string | null }>(
      `/entries/suggest-account${query({ description })}`,
    ),
}
