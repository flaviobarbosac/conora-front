import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  ImportFormat,
  ImportRow,
  ImportPreview,
} from './types'
export const importsApi = {
  preview: (fileName: string, format: ImportFormat, content: string) =>
    apiFetch<ImportPreview>('/imports/preview', json('POST', { fileName, format, content })),
  setRow: (batchId: string, rowId: string, willImport: boolean) =>
    apiFetch<ImportRow>(`/imports/${batchId}/rows/${rowId}`, json('PUT', { willImport })),
  commit: (batchId: string, accountId: string, defaultExpenseCategoryId?: string, defaultIncomeCategoryId?: string) =>
    apiFetch<{ batchId: string; imported: number; skipped: number }>(
      `/imports/${batchId}/commit`,
      json('POST', { accountId, defaultExpenseCategoryId, defaultIncomeCategoryId }),
    ),
}
