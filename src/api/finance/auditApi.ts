import { apiFetch } from '../client'
import { query } from './helpers'
import type {
  Paged,
  AuditEvent,
} from './types'
export const auditApi = {
  list: (entityName?: string, entityId?: string, skip = 0, take = 50) =>
    apiFetch<Paged<AuditEvent>>(`/audit-events${query({ entityName, entityId, skip, take })}`),
}
