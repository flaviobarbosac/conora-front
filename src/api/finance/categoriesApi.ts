import { apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  CategorySection,
  Category,
} from './types'
export const categoriesApi = {
  list: (
    section?: CategorySection,
    includeInactive = false,
    analyticalOnly = false,
    includePending = false,
  ) =>
    apiFetch<Category[]>(
      `/categories${query({ section, includeInactive, analyticalOnly, includePending })}`,
    ),
  create: (name: string, parentId: string) =>
    apiFetch<Category>('/categories', json('POST', { name, parentId })),
  update: (id: string, name: string, isActive: boolean) =>
    apiFetch<Category>(`/categories/${id}`, json('PUT', { name, isActive })),
  setActive: (id: string, isActive: boolean) =>
    apiFetch<Category>(`/categories/${id}/active`, json('PUT', { isActive })),
  approve: (id: string) => apiFetch<Category>(`/categories/${id}/approve`, json('POST')),
  reject: (id: string) => apiFetch<void>(`/categories/${id}/reject`, json('POST')),
  remove: (id: string) => apiFetch<void>(`/categories/${id}`, json('DELETE')),
}
