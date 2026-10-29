import type { Entry } from './types'

export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const json = (method: string, body?: unknown) => ({ method, body })

export function entryDisplayDescription(entry: Entry): string {
  const base = entry.description?.trim() || 'Lançamento'
  if (entry.canEdit === false && entry.postedByName) {
    return `${base} - ${entry.postedByName}`
  }
  return base
}
