import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  LifeProject,
  LifeProjectInput,
} from './types'
export const projectsApi = {
  list: () => apiFetch<LifeProject[]>('/life-projects'),
  get: (id: string) => apiFetch<LifeProject>(`/life-projects/${id}`),
  create: (input: LifeProjectInput) =>
    apiFetch<LifeProject>('/life-projects', json('POST', input)),
  update: (id: string, input: LifeProjectInput) =>
    apiFetch<LifeProject>(`/life-projects/${id}`, json('PUT', input)),
  remove: (id: string) => apiFetch<void>(`/life-projects/${id}`, json('DELETE')),
  contribute: (
    id: string,
    input: { amount: number; occurredAt: string; accountId: string; categoryId: string; description?: string },
  ) => apiFetch<unknown>(`/life-projects/${id}/contributions`, json('POST', input)),
}
