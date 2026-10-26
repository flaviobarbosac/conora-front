import type { Category } from '../api/finance'

/** Display name only — category numbering is not shown in the UI by default. */
export function categoryLabel(account: Pick<Category, 'name' | 'displayNumber'>): string {
  return account.name
}

/**
 * When a screen must show the account number, the only allowed format is
 * `1.1.1-nome da categoria` (hyphen, no spaces around it).
 */
export function categoryLabelWithNumber(account: Pick<Category, 'name' | 'displayNumber'>): string {
  const number = account.displayNumber?.trim()
  if (!number) {
    return account.name
  }
  return `${number}-${account.name}`
}
