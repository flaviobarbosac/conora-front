import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  DeleteAccountInput,
  LgpdExportStatus,
} from './types'
export const lgpdApi = {
  exportData: () => apiFetch<unknown>('/me/data'),
  status: () => apiFetch<LgpdExportStatus>('/me/data/status'),
  deleteAccount: (body?: DeleteAccountInput) => apiFetch<void>('/me/delete', json('POST', body ?? {})),
}
