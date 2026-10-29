import { apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  WhatsAppDraftStatus,
  WhatsAppLink,
  WhatsAppDraft,
} from './types'
export const whatsappApi = {
  link: () => apiFetch<WhatsAppLink | undefined>('/whatsapp/link'),
  setLink: (phone: string) => apiFetch<WhatsAppLink>('/whatsapp/link', json('POST', { phone })),
  unlink: () => apiFetch<void>('/whatsapp/link', json('DELETE')),
  drafts: (status?: WhatsAppDraftStatus) => apiFetch<WhatsAppDraft[]>(`/whatsapp/drafts${query({ status })}`),
  confirm: (id: string, accountId?: string, categoryId?: string) =>
    apiFetch<unknown>(`/whatsapp/drafts/${id}/confirm`, json('POST', { accountId, categoryId })),
  discard: (id: string) => apiFetch<unknown>(`/whatsapp/drafts/${id}/discard`, json('POST')),
}
