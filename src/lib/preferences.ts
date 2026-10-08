export const PREF_KEYS = {
  sidebarCollapsed: 'conora.sidebarCollapsed',
} as const

export const PREFERENCES_CHANGED = 'conora.preferences'

export function readSidebarCollapsed(): boolean {
  return localStorage.getItem(PREF_KEYS.sidebarCollapsed) === 'true'
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(PREF_KEYS.sidebarCollapsed, String(collapsed))
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED, { detail: { key: PREF_KEYS.sidebarCollapsed } }))
}
