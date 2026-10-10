import type { Category } from '../api/finance'

/** Display name only — category numbering is not shown in the UI. */
export function categoryLabel(account: Pick<Category, 'name' | 'displayNumber'>): string {
  return account.name
}
