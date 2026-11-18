import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  ConsoleGeoConfig,
  ConsoleGeoCoordenada,
  ConsoleGeoMap,
  ConsoleKpis,
  ConsoleUserAccess,
  JourneyAbandonmentRow,
  PlanKind,
} from './types'
export const consoleApi = {
  kpis: () => apiFetch<ConsoleKpis>('/console/kpis'),
  geo: () => apiFetch<ConsoleGeoMap>('/console/geo'),
  geoConfig: () => apiFetch<ConsoleGeoConfig>('/console/geo/config'),
  saveGeoConfig: (body: Pick<ConsoleGeoConfig, 'pinLabelCampo' | 'pinLabelTexto' | 'mostrarRotulo' | 'camposVisiveis'>) =>
    apiFetch<ConsoleGeoConfig>('/console/geo/config', json('PUT', body)),
  geoCoordenadas: (itens: ConsoleGeoCoordenada[]) =>
    apiFetch<{ alterados: number }>('/console/geo/coordenadas', json('POST', itens)),
  abandonment: () => apiFetch<JourneyAbandonmentRow[]>('/console/abandonment'),
  listUsers: () => apiFetch<ConsoleUserAccess[]>('/console/users/registered'),
  setGrant: (id: string, indefinite: boolean, until: string | null) =>
    apiFetch<ConsoleUserAccess>(`/console/users/${id}/grant`, json('POST', { indefinite, until })),
  assignPlan: (id: string, plan: PlanKind) =>
    apiFetch<ConsoleUserAccess>(`/console/users/${id}/plan`, json('POST', { plan })),
}
