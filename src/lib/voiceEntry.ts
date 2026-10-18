import { accountsApi, categoriesApi, entriesApi, type Account, type Category, type CategorySection, type VoiceEntryDraft } from '../api/finance'
import { CASH_FLOW_SECTIONS, EXPENSE_SECTIONS } from './categoryOrder'
import { dateToApi, todayInput } from './format'

export type VoiceCommit =
  | { status: 'saved'; id: string }
  | { status: 'needs-form'; description: string; amount: string }
  | { status: 'incomplete'; message: string }
  | { status: 'rejected'; message: string; clear: Array<'categoryName' | 'accountName'> }

type Catalog = { accounts: Account[]; categories: Category[] }

let catalogCache: Catalog | null = null
let catalogLoad: Promise<Catalog> | null = null

export function prefetchVoiceCatalog(): void {
  if (!catalogLoad) {
    catalogLoad = Promise.all([
      accountsApi.list(),
      categoriesApi.list(undefined, false, true),
    ]).then(([accounts, categories]) => {
      catalogCache = { accounts, categories }
      return catalogCache
    }).catch((error: unknown) => {
      catalogLoad = null
      throw error
    })
  }
}

async function catalog(): Promise<Catalog> {
  if (catalogCache) {
    return catalogCache
  }
  prefetchVoiceCatalog()
  return catalogLoad!
}

export function resolveSpokenDate(date: string | null | undefined): string {
  return resolveDate(date)
}

export function matchByName<T extends { name: string }>(spoken: string | null, items: T[]): T | null {
  return bestByName(spoken, items)
}

function resolveDate(date: string | null | undefined): string {
  if (!date || date === 'hoje') {
    return todayInput()
  }
  if (date === 'ontem') {
    const day = new Date()
    day.setDate(day.getDate() - 1)
    const month = String(day.getMonth() + 1).padStart(2, '0')
    return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`
  }
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(date.trim())
  if (slash) {
    const year = slash[3]
      ? (slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : String(new Date().getFullYear())
    return `${year}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayInput()
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function bestByName<T extends { name: string }>(spoken: string | null, items: T[]): T | null {
  return lookupByName(spoken, items).match
}

function lookupByName<T extends { name: string }>(
  spoken: string | null,
  items: T[],
): { match: T | null; ambiguous: boolean } {
  if (!spoken) {
    return { match: null, ambiguous: false }
  }
  const needle = fold(spoken)
  if (!needle) {
    return { match: null, ambiguous: false }
  }
  const exact = items.filter((item) => fold(item.name) === needle)
  if (exact.length === 1) {
    return { match: exact[0], ambiguous: false }
  }
  if (exact.length > 1) {
    return { match: null, ambiguous: true }
  }
  const partial = items.filter((item) => {
    const name = fold(item.name)
    return name.includes(needle) || needle.includes(name)
  })
  if (partial.length === 1) {
    return { match: partial[0], ambiguous: false }
  }
  return { match: null, ambiguous: partial.length > 1 }
}

function nameProblem(kind: 'categoria' | 'conta', spoken: string, ambiguous: boolean): string {
  if (ambiguous) {
    return `Tem mais de uma ${kind} parecida com ${spoken}. Diz o nome completo.`
  }
  return `A ${kind} ${spoken} não existe. Diz outra.`
}

/** Saves a spoken entry. Rejects a category or account that is not on file. */
export async function commitVoiceEntry(
  entry: VoiceEntryDraft,
  onSaving?: () => void,
): Promise<VoiceCommit> {
  if (entry.amount == null || entry.amount <= 0 || !entry.description?.trim() || !entry.accountName?.trim() || !entry.categoryName?.trim()) {
    return { status: 'incomplete', message: 'Ainda falta algum dado do lançamento.' }
  }

  const { accounts, categories } = await catalog()
  const openAccounts = accounts.filter((account) => !account.isArchived)
  const sections: CategorySection[] = entry.type === 'Income' ? ['Income'] : [...EXPENSE_SECTIONS]
  const posting = categories.filter(
    (category) => category.level === 'Analytical'
      && category.isActive
      && CASH_FLOW_SECTIONS.includes(category.section)
      && sections.includes(category.section),
  )

  const categoryHit = lookupByName(entry.categoryName, posting)
  const accountHit = lookupByName(entry.accountName, openAccounts)
  const clear: Array<'categoryName' | 'accountName'> = []
  const problems: string[] = []
  if (!categoryHit.match) {
    clear.push('categoryName')
    problems.push(nameProblem('categoria', entry.categoryName.trim(), categoryHit.ambiguous))
  }
  if (!accountHit.match) {
    clear.push('accountName')
    problems.push(nameProblem('conta', entry.accountName.trim(), accountHit.ambiguous))
  }
  if (clear.length > 0) {
    return { status: 'rejected', message: problems.join(' '), clear }
  }

  const account = accountHit.match!
  onSaving?.()

  const created = await entriesApi.create({
    type: entry.type === 'Income' ? 'Income' : 'Expense',
    amount: entry.amount,
    occurredAt: dateToApi(resolveDate(entry.date)),
    description: entry.description.trim(),
    accountId: account.id,
    categoryId: categoryHit.match!.id,
  })
  return { status: 'saved', id: created[0]?.id ?? '' }
}
