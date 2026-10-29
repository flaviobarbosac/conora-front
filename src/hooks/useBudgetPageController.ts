import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  budgetsApi,
  categoriesApi,
  monthsApi,
  projectsApi,
  type SharingScope,
} from '../api/finance'
import { useLoad } from './useLoad'
import { useUnsavedChanges } from './useUnsavedChanges'
import { currentCompetence } from '../lib/format'
import { readSharingView } from '../lib/sharingView'

function safeReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  if (!raw.startsWith('/raio-x')) return null
  return raw
}

/** Container state for Budget page (data + route params). */
export function useBudgetPageController() {
  const [searchParams, setSearchParams] = useSearchParams()
  const focusCategoryId = searchParams.get('categoryId')
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const [ym, setYm] = useState(() => searchParams.get('competenceYm') || currentCompetence())
  const [scope, setScope] = useState<SharingScope | undefined>(() => readSharingView())
  const { confirmLeave, isDirty } = useUnsavedChanges()
  const budget = useLoad(() => budgetsApi.get(ym, scope), [ym, scope])
  const year = useMemo(() => Number(ym.slice(0, 4)), [ym])
  const yearData = useLoad(() => budgetsApi.getYear(year, scope), [year, scope])
  const categories = useLoad(() => categoriesApi.list(undefined, false, false), [])
  const projects = useLoad(() => projectsApi.list(), [])
  const monthStatus = useLoad(() => monthsApi.get(ym), [ym])

  return {
    searchParams,
    setSearchParams,
    focusCategoryId,
    returnTo,
    ym,
    setYm,
    scope,
    setScope,
    confirmLeave,
    isDirty,
    budget,
    year,
    yearData,
    categories,
    projects,
    monthStatus,
  }
}
