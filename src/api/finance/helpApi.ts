import { apiFetch } from '../client'
import type {
  HelpModule,
  Help,
} from './types'
export const helpApi = {
  get: () => apiFetch<Help>('/help'),
  module: (key: string) => apiFetch<HelpModule>(`/help/modules/${key}`),
}
