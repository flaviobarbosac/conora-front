import { journeyApi } from '../api/finance'

let lastPath: string | null = null
let queued: Promise<void> = Promise.resolve()

/** Fire-and-forget navigation breadcrumb for the abandonment console. */
export function trackJourney(path: string, kind: 'Login' | 'Navigate' | 'Register' = 'Navigate') {
  const next = path || '/'
  if (kind === 'Navigate' && next === lastPath) {
    return
  }
  lastPath = next
  queued = queued
    .then(() => journeyApi.track(next, kind).catch(() => undefined))
    .then(() => undefined)
}
