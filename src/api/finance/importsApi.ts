import { apiFetch, apiFormData } from '../client'
import { json } from './helpers'
import type {
  AccountKind,
  ImportCurrentRow,
  ImportFormat,
  ImportPreview,
  ImportReport,
  ImportRow,
} from './types'

export const importsApi = {
  preview: (fileName: string, format: ImportFormat, content: string, competenceYm?: string) =>
    apiFetch<ImportPreview>(
      '/imports/preview',
      json('POST', { fileName, format, content, competenceYm }),
    ),

  upload: (file: File, competenceYm: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('competenceYm', competenceYm)
    return apiFormData<ImportPreview>('/imports/upload', form)
  },

  open: async (competenceYm: string) => {
    const response = await apiFetch<ImportPreview | undefined>(
      `/imports/open?competenceYm=${encodeURIComponent(competenceYm)}`,
    )
    return response ?? null
  },

  get: (batchId: string) => apiFetch<ImportPreview>(`/imports/${batchId}`),

  current: async (batchId: string) => {
    const row = await apiFetch<ImportCurrentRow | undefined>(`/imports/${batchId}/current`)
    return row ?? null
  },

  report: (batchId: string) => apiFetch<ImportReport>(`/imports/${batchId}/report`),

  bindAccount: (
    batchId: string,
    body: { accountId?: string; createIfMissing?: boolean; name?: string; kind?: AccountKind },
  ) => apiFetch<ImportPreview>(`/imports/${batchId}/account`, json('POST', body)),

  discard: (batchId: string) => apiFetch<void>(`/imports/${batchId}/discard`, json('POST', {})),

  setRow: (batchId: string, rowId: string, willImport: boolean) =>
    apiFetch<ImportRow>(`/imports/${batchId}/rows/${rowId}`, json('PUT', { willImport })),

  commitRow: (batchId: string, rowId: string, categoryId: string, confirmDuplicate = false) =>
    apiFetch<ImportCurrentRow | null>(
      `/imports/${batchId}/rows/${rowId}/commit`,
      json('POST', { categoryId, confirmDuplicate }),
    ),

  deferRow: (batchId: string, rowId: string) =>
    apiFetch<ImportCurrentRow | null>(`/imports/${batchId}/rows/${rowId}/defer`, json('POST', {})),

  ignoreRow: (batchId: string, rowId: string) =>
    apiFetch<ImportCurrentRow | null>(`/imports/${batchId}/rows/${rowId}/ignore`, json('POST', {})),

  skipDuplicate: (batchId: string, rowId: string) =>
    apiFetch<ImportCurrentRow | null>(`/imports/${batchId}/rows/${rowId}/skip-duplicate`, json('POST', {})),

  commit: (batchId: string, accountId: string, defaultExpenseCategoryId?: string, defaultIncomeCategoryId?: string) =>
    apiFetch<{ batchId: string; imported: number; skipped: number }>(
      `/imports/${batchId}/commit`,
      json('POST', { accountId, defaultExpenseCategoryId, defaultIncomeCategoryId }),
    ),
}
