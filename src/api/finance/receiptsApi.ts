import { apiFetch, apiFormData } from '../client'
import { json } from './helpers'
import type {
  Category,
  Entry,
  ReceiptChannel,
  ReceiptPurpose,
  ReceiptIntake,
  BudgetBoletoConfirm,
} from './types'
export const receiptsApi = {
  upload: (
    file: Blob,
    fileName: string,
    channel: ReceiptChannel = 'App',
    purpose: ReceiptPurpose = 'Expense',
  ) => {
    const form = new FormData()
    form.append('file', file, fileName)
    form.append('channel', channel)
    form.append('purpose', purpose)
    return apiFormData<ReceiptIntake>('/receipts', form)
  },
  get: (id: string) => apiFetch<ReceiptIntake>(`/receipts/${id}`),
  categories: () => apiFetch<Category[]>('/receipts/categories'),
  classify: (id: string, categoryCode: string) =>
    apiFetch<ReceiptIntake>(`/receipts/${id}/classify`, json('POST', { categoryCode })),
  linkSupplier: (id: string, supplierId: string) =>
    apiFetch<ReceiptIntake>(`/receipts/${id}/link-supplier`, json('POST', { supplierId })),
  confirm: (
    id: string,
    body: {
      accountId?: string
      categoryId?: string
      amount?: number
      occurredAt?: string
      description?: string
      confirmDuplicate?: boolean
    },
  ) => apiFetch<Entry>(`/receipts/${id}/confirm`, json('POST', body)),
  confirmBudget: (
    id: string,
    body?: {
      categoryId?: string
      amount?: number
      occurredAt?: string
      description?: string
    },
  ) => apiFetch<BudgetBoletoConfirm>(`/receipts/${id}/confirm-budget`, json('POST', body ?? {})),
}
