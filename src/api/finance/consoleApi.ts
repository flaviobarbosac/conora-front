import { apiFetch } from '../client'
import type {
  ConsoleKpis,
  JourneyAbandonmentRow,
} from './types'
export const consoleApi = {
  kpis: () => apiFetch<ConsoleKpis>('/console/kpis'),
  abandonment: () => apiFetch<JourneyAbandonmentRow[]>('/console/abandonment'),
}
