import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  IncomeSource,
  DiagnosisSummary,
  IncomeSourceInput,
} from './types'
export const diagnosisApi = {
  get: (ym: string) => apiFetch<DiagnosisSummary>(`/diagnosis/${ym}`),
  create: (input: IncomeSourceInput) => apiFetch<IncomeSource>('/diagnosis/income-sources', json('POST', input)),
  remove: (id: string) => apiFetch<void>(`/diagnosis/income-sources/${id}`, json('DELETE')),
}
