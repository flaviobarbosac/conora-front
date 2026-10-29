import { apiFetch } from '../client'
import { json } from './helpers'
export const journeyApi = {
  track: (path: string, kind: 'Login' | 'Navigate' | 'Register' = 'Navigate') =>
    apiFetch<void>('/journey', json('POST', { path, kind })),
}
