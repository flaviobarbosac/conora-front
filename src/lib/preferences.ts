import type { BudgetMode } from '../api/finance'

export const PREF_KEYS = {
  sidebarCollapsed: 'conora.sidebarCollapsed',
  defaultBudgetMode: 'conora.defaultBudgetMode',
} as const

export const PREFERENCES_CHANGED = 'conora.preferences'

export function readSidebarCollapsed(): boolean {
  return localStorage.getItem(PREF_KEYS.sidebarCollapsed) === 'true'
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(PREF_KEYS.sidebarCollapsed, String(collapsed))
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED, { detail: { key: PREF_KEYS.sidebarCollapsed } }))
}

export function readDefaultBudgetMode(): BudgetMode {
  return localStorage.getItem(PREF_KEYS.defaultBudgetMode) === 'Detailed' ? 'Detailed' : 'Simple'
}

export function writeDefaultBudgetMode(mode: BudgetMode): void {
  localStorage.setItem(PREF_KEYS.defaultBudgetMode, mode)
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED, { detail: { key: PREF_KEYS.defaultBudgetMode } }))
}
