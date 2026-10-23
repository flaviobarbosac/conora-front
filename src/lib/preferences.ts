export const PREF_KEYS = {
  sidebarCollapsed: 'conora.sidebarCollapsed',
  /** When true (default), home shows the Jornada Raio X timeline below the launch O. */
  homeJourneyTimeline: 'conora.homeJourneyTimeline',
} as const

export const PREFERENCES_CHANGED = 'conora.preferences'

export function readSidebarCollapsed(): boolean {
  return localStorage.getItem(PREF_KEYS.sidebarCollapsed) === 'true'
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(PREF_KEYS.sidebarCollapsed, String(collapsed))
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED, { detail: { key: PREF_KEYS.sidebarCollapsed } }))
}

/** Absent key = show (first visits until the user closes or unchecks on /jornada). */
export function readHomeJourneyTimeline(): boolean {
  const raw = localStorage.getItem(PREF_KEYS.homeJourneyTimeline)
  if (raw === null) return true
  return raw === 'true'
}

export function writeHomeJourneyTimeline(show: boolean): void {
  localStorage.setItem(PREF_KEYS.homeJourneyTimeline, String(show))
  window.dispatchEvent(
    new CustomEvent(PREFERENCES_CHANGED, { detail: { key: PREF_KEYS.homeJourneyTimeline } }),
  )
}
