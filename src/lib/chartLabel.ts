import type { ChartAccount } from '../api/finance'

export function chartAccountLabel(account: Pick<ChartAccount, 'name' | 'displayNumber'>): string {
  return account.displayNumber ? `${account.displayNumber} ${account.name}` : account.name
}
