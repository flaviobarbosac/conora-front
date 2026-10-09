import type { ChartAccount } from '../api/finance'

export type HorizonKey = 'short' | 'mid' | 'long'

export const LIFE_HORIZONS: { key: HorizonKey; code: string; label: string }[] = [
  { key: 'short', code: 'LIFE_SHORT', label: 'Curto prazo' },
  { key: 'mid', code: 'LIFE_MID', label: 'Médio prazo' },
  { key: 'long', code: 'LIFE_LONG', label: 'Longo prazo' },
]

/** Curto = verde, médio = amarelo, longo = azul (info). Red is reserved for budget overrun. */
export function horizonFillClass(
  styles: Record<string, string>,
  key: HorizonKey,
): string {
  if (key === 'short') return styles.progressFill_ok
  if (key === 'mid') return styles.progressFill_warning
  return styles.progressFill_info ?? styles.progressFillPlanned
}

export function horizonCodeOf(accountId: string | null, accounts: ChartAccount[]): string | null {
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

export function horizonLabelOf(accountId: string | null, accounts: ChartAccount[]): string | null {
  const code = horizonCodeOf(accountId, accounts)
  return LIFE_HORIZONS.find((item) => item.code === code)?.label ?? null
}
