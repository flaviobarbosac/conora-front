import type { Category } from '../api/finance'

export type HorizonKey = 'short' | 'mid' | 'long'

export const LIFE_HORIZONS: { key: HorizonKey; code: string; label: string }[] = [
  { key: 'short', code: 'LIFE_SHORT', label: 'Curto prazo' },
  { key: 'mid', code: 'LIFE_MID', label: 'Médio prazo' },
  { key: 'long', code: 'LIFE_LONG', label: 'Longo prazo' },
]

type StyleMap = Record<string, string | undefined>

/**
 * Horizon color is classification, not an alert.
 * Short = green, mid = yellow, long = blue (horizon token, not --danger).
 */
export function horizonFillClass(styles: StyleMap, key: HorizonKey): string {
  if (key === 'short') return styles.progressFill_ok ?? ''
  if (key === 'mid') return styles.progressFill_warning ?? ''
  return styles.progressFill_horizonLong ?? ''
}

export function horizonBadgeClass(styles: StyleMap, key: HorizonKey): string {
  if (key === 'short') return styles.badge_ok ?? ''
  if (key === 'mid') return styles.badge_warning ?? ''
  return styles.badge_horizonLong ?? ''
}

/** Accumulated above the goal. Uses danger red; the label is "Acima da meta". */
export function isProjectExtrapolated(project: {
  accumulatedAmount: number
  goalAmount: number
}): boolean {
  return project.goalAmount > 0 && project.accumulatedAmount > project.goalAmount + 0.004
}

/** Bar color for one project: extrapolation is red; otherwise the horizon color (long = blue). */
export function projectFillClass(
  styles: StyleMap,
  project: {
    horizon: HorizonKey | null
    accumulatedAmount: number
    goalAmount: number
  },
): string {
  if (isProjectExtrapolated(project)) {
    return styles.progressFill_danger ?? ''
  }
  if (project.horizon === 'short' || project.horizon === 'mid' || project.horizon === 'long') {
    return horizonFillClass(styles, project.horizon)
  }
  return ''
}

export function horizonCodeOf(accountId: string | null, accounts: Category[]): string | null {
  if (!accountId) {
    return null
  }
  const byId = new Map(accounts.map((account) => [account.id, account]))
  let current = byId.get(accountId)
  while (current) {
    if (current.code === 'LIFE_SHORT' || current.code === 'LIFE_MID' || current.code === 'LIFE_LONG') {
      return current.code
    }
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return null
}

export function horizonLabelOf(accountId: string | null, accounts: Category[]): string | null {
  const code = horizonCodeOf(accountId, accounts)
  return LIFE_HORIZONS.find((item) => item.code === code)?.label ?? null
}
