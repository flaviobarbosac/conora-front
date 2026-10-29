import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  Card,
  CardInvoice,
  CardPurchaseInput,
} from './types'
export const cardsApi = {
  list: () => apiFetch<Card[]>('/credit-cards'),
  create: (name: string, limitTotal: number, closingDay: number, dueDay: number, paymentAccountId?: string) =>
    apiFetch<Card>('/credit-cards', json('POST', { name, limitTotal, closingDay, dueDay, paymentAccountId })),
  remove: (id: string) => apiFetch<void>(`/credit-cards/${id}`, json('DELETE')),
  purchase: (id: string, input: CardPurchaseInput) =>
    apiFetch<unknown>(`/credit-cards/${id}/purchases`, json('POST', input)),
  invoices: (id: string) => apiFetch<CardInvoice[]>(`/credit-cards/${id}/invoices`),
  payInvoice: (id: string, competenceYm: string, accountId?: string) =>
    apiFetch<CardInvoice>(`/credit-cards/${id}/invoices/${competenceYm}/pay`, json('POST', { accountId })),
}
