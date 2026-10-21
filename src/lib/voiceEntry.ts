import { accountsApi, aiApi, budgetsApi, categoriesApi, entriesApi, projectsApi, type Account, type Category, type CategorySection, type VoiceEntryDraft } from '../api/finance'
import type { SpokenEntry } from './voiceInterview'
import { CASH_FLOW_SECTIONS, PATRIMONY_SECTIONS } from './categoryOrder'
import { currentCompetence, dateToApi, todayInput } from './format'

export type VoiceCommit =
  | { status: 'saved'; id: string }
  | { status: 'needs-form'; description: string; amount: string }
  | { status: 'incomplete'; message: string }
  | { status: 'rejected'; message: string; clear: Array<'categoryName' | 'accountName' | 'projectName'> }

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
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
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

function exactByName<T extends { name: string }>(spoken: string | null, items: T[]): T | null {
  if (!spoken?.trim()) {
    return null
  }
  const needle = fold(spoken)
  const exact = items.filter((item) => fold(item.name) === needle)
  return exact.length === 1 ? exact[0] : null
}

function joinSpoken(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? ''
  }
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

export function categorySuggestion(spoken: string, names: string[]): string {
  const options = names.map((name) => name.trim()).filter(Boolean).slice(0, 4)
  if (options.length === 0) {
    return `Não achei ${spoken}. Diz outra categoria.`
  }
  return `Não achei ${spoken}, mas tenho ${joinSpoken(options)}. Qual você escolhe?`
}

function postingCategories(categories: Category[], entry: VoiceEntryDraft): Category[] {
  const sections: CategorySection[] = entry.kind === 'budget'
    ? [...CASH_FLOW_SECTIONS]
    : entry.type === 'Income' || entry.type === 'ProjectContribution'
      ? ['Income', 'LifeProject', ...PATRIMONY_SECTIONS]
      : ['Discount', 'Essential', 'Social', ...PATRIMONY_SECTIONS]
  return categories.filter(
    (category) => category.level === 'Analytical'
      && category.isActive
      && sections.includes(category.section),
  )
}

export type CategorySuggestion = { message: string; names: string[] }

/** Null when the spoken category is already on file. Otherwise the line and the options. */
export async function unknownCategoryMessage(entry: VoiceEntryDraft): Promise<CategorySuggestion | null> {
  const spoken = entry.categoryName?.trim()
  if (!spoken) {
    return null
  }
  const { categories } = await catalog()
  const posting = postingCategories(categories, entry)
  if (exactByName(spoken, posting)) {
    return null
  }
  let names: string[] = []
  try {
    const suggestType = entry.kind === 'budget'
      ? 'Budget'
      : entry.type === 'Income'
        ? 'Income'
        : entry.type === 'ProjectContribution'
          ? 'ProjectContribution'
          : 'Expense'
    const result = await aiApi.suggestCategories(spoken, suggestType)
    names = (result.names ?? []).map((name) => name.trim()).filter(Boolean).slice(0, 4)
  } catch {
    names = []
  }
  return { message: categorySuggestion(spoken, names), names }
}

export async function fillAporteCategory(entry: SpokenEntry): Promise<void> {
  if ((entry.type !== 'Income' && entry.type !== 'ProjectContribution') || entry.categoryName || !entry.projectName?.trim()) {
    return
  }
  const project = exactByName(entry.projectName, await projectsApi.list())
  if (project?.categoryName) {
    entry.categoryName = project.categoryName
  }
}

export async function unknownProjectMessage(spoken: string): Promise<CategorySuggestion | null> {
  const name = spoken.trim()
  if (!name) {
    return null
  }
  const projects = await projectsApi.list()
  if (exactByName(name, projects)) {
    return null
  }
  const names = similarNames(name, projects)
  if (names.length === 0) {
    return { message: `Não achei o projeto ${name}.`, names: [] }
  }
  return { message: `Não achei o projeto ${name}, mas tenho ${joinSpoken(names)}. Qual você escolhe?`, names }
}

function similarNames(spoken: string, items: Array<{ name: string }>): string[] {
  const needle = fold(spoken)
  const partial = items.filter((item) => {
    const name = fold(item.name)
    return name.includes(needle) || needle.includes(name)
  })
  const source = partial.length > 0 ? partial : items
  return source.map((item) => item.name.trim()).filter(Boolean).slice(0, 4)
}

/** Saves a spoken entry. Rejects a category or account that is not on file. */
export async function commitVoiceEntry(
  entry: VoiceEntryDraft,
  onSaving?: () => void,
): Promise<VoiceCommit> {
  if (entry.kind === 'budget') {
    return commitBudget(entry, onSaving)
  }
  const type = entry.type === 'ProjectContribution' ? 'Income' : entry.type
  if (entry.amount == null || entry.amount <= 0 || !entry.description?.trim() || !entry.accountName?.trim() || !entry.categoryName?.trim()) {
    return { status: 'incomplete', message: 'Ainda falta algum dado do lançamento.' }
  }

  const { accounts, categories } = await catalog()
  const openAccounts = accounts.filter((account) => !account.isArchived)
  const posting = postingCategories(categories, { ...entry, type })

  const category = exactByName(entry.categoryName, posting)
  const accountHit = lookupByName(entry.accountName, openAccounts)
  const clear: Array<'categoryName' | 'accountName'> = []
  const problems: string[] = []
  if (!category) {
    clear.push('categoryName')
    problems.push((await unknownCategoryMessage(entry))?.message ?? categorySuggestion(entry.categoryName.trim(), []))
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

  const occurred = resolveDate(entry.date)
  const created = await entriesApi.create({
    type: type === 'Income' ? 'Income' : 'Expense',
    amount: entry.amount,
    occurredAt: dateToApi(occurred),
    competenceYm: occurred.slice(0, 7),
    description: entry.description.trim(),
    accountId: account.id,
    categoryId: category!.id,
  })
  return { status: 'saved', id: created[0]?.id ?? '' }
}

async function commitBudget(
  entry: VoiceEntryDraft,
  onSaving?: () => void,
): Promise<VoiceCommit> {
  if (entry.amount == null || entry.amount <= 0 || !entry.categoryName?.trim()) {
    return { status: 'incomplete', message: 'Ainda falta o valor ou a categoria do orçamento.' }
  }
  const { categories } = await catalog()
  const posting = postingCategories(categories, entry)
  const category = exactByName(entry.categoryName, posting)
  if (!category) {
    const suggestion = await unknownCategoryMessage(entry)
    return {
      status: 'rejected',
      message: suggestion?.message ?? categorySuggestion(entry.categoryName.trim(), []),
      clear: ['categoryName'],
    }
  }
  onSaving?.()
  await budgetsApi.upsert(currentCompetence(), 'Detailed', [
    { categoryId: category.id, plannedAmount: entry.amount },
  ])
  return { status: 'saved', id: category.id }
}
