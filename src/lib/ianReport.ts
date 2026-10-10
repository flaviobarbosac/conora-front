import type { IanReportQuery } from '../api/finance'
import { currentCompetence, shiftCompetence } from './format'

const ANALYZE_STORAGE_KEY = 'conora.ian.analyze.selection'

export type IanAnalyzeSelection = {
  categoryIds: string[]
  fromYm: string
  toYm: string
}

export function ianReportHref(query: IanReportQuery): string {
  const params = new URLSearchParams()
  params.set('kind', query.kind)
  if (query.competenceYm) params.set('competenceYm', query.competenceYm)
  if (query.fromYm) params.set('fromYm', query.fromYm)
  if (query.toYm) params.set('toYm', query.toYm)
  if (query.subject) params.set('subject', query.subject)
  if (query.matchKind) params.set('matchKind', query.matchKind)
  if (query.matchId) params.set('matchId', query.matchId)
  if (query.focus) params.set('focus', query.focus)
  if (query.categoryIds) params.set('categoryIds', query.categoryIds)
  if (query.chartKind) params.set('chartKind', query.chartKind)
  if (query.insight) params.set('insight', query.insight)
  return `/ian/relatorio?${params.toString()}`
}

export function saveIanAnalyzeSelection(selection: IanAnalyzeSelection): void {
  try {
    sessionStorage.setItem(ANALYZE_STORAGE_KEY, JSON.stringify(selection))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadIanAnalyzeSelection(): IanAnalyzeSelection | null {
  try {
    const raw = sessionStorage.getItem(ANALYZE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as IanAnalyzeSelection
    if (!Array.isArray(parsed.categoryIds) || !parsed.fromYm || !parsed.toYm) return null
    return parsed
  } catch {
    return null
  }
}

export function selectionFromReportQuery(query: IanReportQuery): IanAnalyzeSelection | null {
  if (query.kind !== 'analyze' || !query.categoryIds || !query.fromYm || !query.toYm) return null
  return {
    categoryIds: query.categoryIds.split(',').map((id) => id.trim()).filter(Boolean),
    fromYm: query.fromYm,
    toYm: query.toYm,
  }
}

export function defaultAnalyzeRange(): { fromYm: string; toYm: string } {
  const toYm = currentCompetence()
  return { fromYm: `${toYm.slice(0, 4)}-01`, toYm }
}

export function analyzePresetRange(preset: 'month' | 'year' | 'last6'): { fromYm: string; toYm: string } {
  const toYm = currentCompetence()
  if (preset === 'month') return { fromYm: toYm, toYm }
  if (preset === 'last6') return { fromYm: shiftCompetence(toYm, -5), toYm }
  return { fromYm: `${toYm.slice(0, 4)}-01`, toYm }
}
