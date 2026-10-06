import { apiBlob, apiFetch } from './client'

/* ---------- Enums (serialized as strings by the API) ---------- */

export type AccountKind = 'Checking' | 'Cash' | 'Other'
export type BudgetMode = 'Simple' | 'Detailed'
export type CategoryKind = 'Expense' | 'Income' | 'Transfer'
export type EntryType =
  | 'Expense'
  | 'Income'
  | 'Transfer'
  | 'Contribution'
  | 'CardPayment'
  | 'ProjectContribution'
export type ImportFormat = 'Csv' | 'Ofx'
export type ImportStatus = 'Preview' | 'Committed'
export type InvoiceStatus = 'Open' | 'Closed' | 'Paid'
export type PatrimonyKind = 'Asset' | 'Liability'
export type PlanKind = 'Monthly1490' | 'Yearly14990'
export type SubscriptionStatus = 'Active' | 'Expired' | 'ReadOnly'
export type WhatsAppDraftStatus = 'Pending' | 'Confirmed' | 'Discarded'

/* ---------- Shared ---------- */

export type Paged<T> = { items: T[]; skip: number; take: number; totalCount: number }

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

const json = (method: string, body?: unknown) => ({ method, body })

/* ---------- Categories ---------- */

export type Category = {
  id: string
  name: string
  code: string | null
  kind: CategoryKind
  isSystem: boolean
  isActive: boolean
  isEssential: boolean
}

export const categoriesApi = {
  list: (kind?: CategoryKind, includeInactive = false) =>
    apiFetch<Category[]>(`/categories${query({ kind, includeInactive })}`),
  create: (name: string, kind: CategoryKind, isEssential: boolean) =>
    apiFetch<Category>('/categories', json('POST', { name, kind, isEssential })),
  update: (id: string, name: string, isEssential: boolean, isActive: boolean) =>
    apiFetch<Category>(`/categories/${id}`, json('PUT', { name, isEssential, isActive })),
  remove: (id: string) => apiFetch<void>(`/categories/${id}`, json('DELETE')),
}

/* ---------- Accounts ---------- */

export type Account = {
  id: string
  name: string
  kind: AccountKind
  balance: number
  isArchived: boolean
}

export const accountsApi = {
  list: (includeArchived = false) => apiFetch<Account[]>(`/accounts${query({ includeArchived })}`),
  create: (name: string, kind: AccountKind, openingBalance: number) =>
    apiFetch<Account>('/accounts', json('POST', { name, kind, openingBalance })),
  archive: (id: string, archived: boolean) =>
    apiFetch<Account>(`/accounts/${id}/archive`, json('POST', { archived })),
  transfer: (fromAccountId: string, toAccountId: string, amount: number, occurredAt: string, description?: string) =>
    apiFetch<unknown>(
      '/accounts/transfers',
      json('POST', { fromAccountId, toAccountId, amount, occurredAt, description }),
    ),
}

/* ---------- Credit cards ---------- */

export type Card = {
  id: string
  name: string
  limitTotal: number
  closingDay: number
  dueDay: number
  paymentAccountId: string | null
  usedLimit: number
  availableLimit: number
}

export type CardInvoice = {
  creditCardId: string
  competenceYm: string
  status: InvoiceStatus
  total: number
  closingDate: string
  dueDate: string
}

export type CardPurchaseInput = {
  amount: number
  purchasedAt: string
  installments: number
  categoryId: string
  description: string
}

export const cardsApi = {
  list: () => apiFetch<Card[]>('/credit-cards'),
  create: (name: string, limitTotal: number, closingDay: number, dueDay: number, paymentAccountId?: string) =>
    apiFetch<Card>('/credit-cards', json('POST', { name, limitTotal, closingDay, dueDay, paymentAccountId })),
  remove: (id: string) => apiFetch<void>(`/credit-cards/${id}`, json('DELETE')),
  purchase: (id: string, input: CardPurchaseInput) =>
    apiFetch<unknown>(`/credit-cards/${id}/purchases`, json('POST', input)),
  invoices: (id: string) => apiFetch<CardInvoice[]>(`/credit-cards/${id}/invoices`),
  payInvoice: (id: string, competenceYm: string, accountId?: string) =>
    apiFetch<CardInvoice>(`/credit-cards/${id}/invoices/${competenceYm}/pay`, json('POST', { accountId })),
}

/* ---------- Entries ---------- */

export type Entry = {
  id: string
  type: EntryType
  amount: number
  occurredAt: string
  competenceYm: string
  accountId: string | null
  contraAccountId: string | null
  categoryId: string | null
  incomeSourceId: string | null
  creditCardId: string | null
  lifeProjectId: string | null
  memberId: string | null
  description: string
  recurrenceKey: string | null
  installmentNumber: number | null
  installmentCount: number | null
}

export type EntryInput = {
  type: EntryType
  amount: number
  occurredAt: string
  description: string
  competenceYm?: string
  accountId?: string
  contraAccountId?: string
  categoryId?: string
  memberId?: string
  installmentCount?: number
  repeatMonths?: number
  confirmDuplicate?: boolean
}

export type EntryFilter = {
  competenceYm?: string
  type?: EntryType
  categoryId?: string
  accountId?: string
  search?: string
  skip?: number
  take?: number
}

export const entriesApi = {
  list: (filter: EntryFilter) => apiFetch<Paged<Entry>>(`/entries${query({ ...filter })}`),
  create: (input: EntryInput) => apiFetch<Entry[]>('/entries', json('POST', input)),
  remove: (id: string) => apiFetch<void>(`/entries/${id}`, json('DELETE')),
  duplicate: (id: string) => apiFetch<Entry[]>(`/entries/${id}/duplicate`, json('POST')),
  suggestCategory: (description: string) =>
    apiFetch<{ categoryId: string | null; categoryName: string | null }>(
      `/entries/suggest-category${query({ description })}`,
    ),
}

/* ---------- Dashboard / reports ---------- */

export type Alert = {
  code: string
  severity: string
  message: string
  categoryId: string | null
  percent: number | null
}

export type Dashboard = {
  competenceYm: string
  isClosed: boolean
  incomeTotal: number
  receivedIncome: number
  expenseTotal: number
  result: number
  contributionsTotal: number
  cardPurchasesTotal: number
  projectContributionsTotal: number
  accountsBalance: number
  alerts: Alert[]
}

export type MonthlyReport = {
  summary: Dashboard
  byCategory: { categoryId: string | null; categoryName: string; amount: number }[]
  previousYm: string
  previousExpenseTotal: number
  expenseDelta: number
  previousResult: number
}

export const dashboardApi = {
  get: (ym: string) => apiFetch<Dashboard>(`/dashboard/${ym}`),
  monthlyReport: (ym: string) => apiFetch<MonthlyReport>(`/reports/monthly/${ym}`),
}

export const exportApi = {
  entries: (competenceYm?: string) => apiBlob(`/export/entries${query({ competenceYm })}`),
  summary: (ym: string) => apiBlob(`/export/summary/${ym}`),
}

/* ---------- Budgets ---------- */

export type BudgetLine = {
  categoryId: string
  categoryName: string
  plannedAmount: number
  actualAmount: number
  remaining: number
  percent: number | null
  status: string
}

export type Budget = {
  competenceYm: string
  mode: BudgetMode
  totalPlanned: number
  totalActual: number
  projectedExpense: number
  lines: BudgetLine[]
}

export const budgetsApi = {
  get: (ym: string) => apiFetch<Budget>(`/budgets/${ym}`),
  upsert: (ym: string, mode: BudgetMode, lines: { categoryId: string; plannedAmount: number }[]) =>
    apiFetch<Budget>(`/budgets/${ym}`, json('PUT', { mode, lines })),
  copyPrevious: (ym: string) => apiFetch<Budget>(`/budgets/${ym}/copy-previous`, json('POST')),
  removeLine: (ym: string, categoryId: string) =>
    apiFetch<void>(`/budgets/${ym}/lines/${categoryId}`, json('DELETE')),
}

/* ---------- Diagnosis ---------- */

export type IncomeSource = {
  id: string
  name: string
  competenceYm: string
  gross: number
  inss: number
  ir: number
  tithe: number
  netSpendable: number
}

export type DiagnosisSummary = {
  competenceYm: string
  gross: number
  inss: number
  ir: number
  netSpendable: number
  plannedTithe: number
  sources: IncomeSource[]
}

export type IncomeSourceInput = {
  name: string
  competenceYm: string
  gross: number
  inss: number
  ir: number
  tithe: number
}

export const diagnosisApi = {
  get: (ym: string) => apiFetch<DiagnosisSummary>(`/diagnosis/${ym}`),
  create: (input: IncomeSourceInput) => apiFetch<IncomeSource>('/diagnosis/income-sources', json('POST', input)),
  remove: (id: string) => apiFetch<void>(`/diagnosis/income-sources/${id}`, json('DELETE')),
}

/* ---------- Life projects ---------- */

export type LifeProject = {
  id: string
  name: string
  goalAmount: number
  dueDate: string | null
  accumulatedAmount: number
  progressPercent: number
}

export const projectsApi = {
  list: () => apiFetch<LifeProject[]>('/life-projects'),
  create: (name: string, goalAmount: number, dueDate?: string) =>
    apiFetch<LifeProject>('/life-projects', json('POST', { name, goalAmount, dueDate })),
  remove: (id: string) => apiFetch<void>(`/life-projects/${id}`, json('DELETE')),
  contribute: (id: string, amount: number, occurredAt: string, accountId?: string, description?: string) =>
    apiFetch<unknown>(`/life-projects/${id}/contributions`, json('POST', { amount, occurredAt, accountId, description })),
}

/* ---------- Patrimony ---------- */

export type PatrimonyItem = { id: string; kind: PatrimonyKind; name: string; amount: number }

export type PatrimonySummary = {
  accountsBalance: number
  assetsTotal: number
  unpaidCardInvoices: number
  liabilitiesTotal: number
  netWorth: number
  items: PatrimonyItem[]
}

export type Reserve = {
  referenceYm: string
  monthlyEssentialAverage: number
  monthsConsidered: number
  source: string
}

export const patrimonyApi = {
  get: () => apiFetch<PatrimonySummary>('/patrimony'),
  reserve: (competenceYm?: string) => apiFetch<Reserve>(`/patrimony/reserve${query({ competenceYm })}`),
  create: (kind: PatrimonyKind, name: string, amount: number) =>
    apiFetch<PatrimonyItem>('/patrimony/items', json('POST', { kind, name, amount })),
  remove: (id: string) => apiFetch<void>(`/patrimony/items/${id}`, json('DELETE')),
}

/* ---------- Members ---------- */

export type Member = { id: string; name: string; isActive: boolean }

export const membersApi = {
  list: () => apiFetch<Member[]>('/members'),
  create: (name: string) => apiFetch<Member>('/members', json('POST', { name, isActive: true })),
  update: (id: string, name: string, isActive: boolean) =>
    apiFetch<Member>(`/members/${id}`, json('PUT', { name, isActive })),
  remove: (id: string) => apiFetch<void>(`/members/${id}`, json('DELETE')),
}

/* ---------- Plan ---------- */

export type Plan = {
  plan: PlanKind | null
  status: SubscriptionStatus
  expiresAt: string | null
  isReadOnly: boolean
  price: number | null
}

export const planApi = {
  get: () => apiFetch<Plan>('/plan'),
  subscribe: (plan: PlanKind) => apiFetch<Plan>('/plan/subscribe', json('POST', { plan })),
}

/* ---------- Help / AI ---------- */

export type Help = {
  steps: { order: number; key: string; title: string; text: string }[]
  glossary: { key: string; term: string; definition: string }[]
}

export const helpApi = { get: () => apiFetch<Help>('/help') }

export type AiAnswer = { available: boolean; answer: string }

export const aiApi = {
  ask: (question: string, competenceYm?: string) =>
    apiFetch<AiAnswer>('/ai/ask', json('POST', { question, competenceYm })),
}

/* ---------- WhatsApp ---------- */

export type WhatsAppLink = { phoneE164: string; linkedAt: string }

export type WhatsAppDraft = {
  id: string
  phoneE164: string
  payloadJson: string
  status: WhatsAppDraftStatus
  createdAt: string
}

export type WhatsAppDraftPayload = {
  type: EntryType
  amount: number
  description: string
  occurredAt: string
}

export const whatsappApi = {
  link: () => apiFetch<WhatsAppLink | undefined>('/whatsapp/link'),
  setLink: (phone: string) => apiFetch<WhatsAppLink>('/whatsapp/link', json('POST', { phone })),
  unlink: () => apiFetch<void>('/whatsapp/link', json('DELETE')),
  drafts: (status?: WhatsAppDraftStatus) => apiFetch<WhatsAppDraft[]>(`/whatsapp/drafts${query({ status })}`),
  confirm: (id: string, accountId?: string, categoryId?: string) =>
    apiFetch<unknown>(`/whatsapp/drafts/${id}/confirm`, json('POST', { accountId, categoryId })),
  discard: (id: string) => apiFetch<unknown>(`/whatsapp/drafts/${id}/discard`, json('POST')),
}

/* ---------- Imports ---------- */

export type ImportRow = {
  id: string
  date: string
  amount: number
  description: string
  isDuplicate: boolean
  willImport: boolean
}

export type ImportPreview = {
  batchId: string
  fileName: string
  format: ImportFormat
  status: ImportStatus
  rowCount: number
  duplicateCount: number
  rows: ImportRow[]
}

export const importsApi = {
  preview: (fileName: string, format: ImportFormat, content: string) =>
    apiFetch<ImportPreview>('/imports/preview', json('POST', { fileName, format, content })),
  setRow: (batchId: string, rowId: string, willImport: boolean) =>
    apiFetch<ImportRow>(`/imports/${batchId}/rows/${rowId}`, json('PUT', { willImport })),
  commit: (batchId: string, accountId: string, defaultExpenseCategoryId?: string, defaultIncomeCategoryId?: string) =>
    apiFetch<{ batchId: string; imported: number; skipped: number }>(
      `/imports/${batchId}/commit`,
      json('POST', { accountId, defaultExpenseCategoryId, defaultIncomeCategoryId }),
    ),
}

/* ---------- Months ---------- */

export type MonthStatus = {
  competenceYm: string
  isClosed: boolean
  closedAt: string | null
  reopenReason: string | null
  closedByUsuarioId: string | null
}

export const monthsApi = {
  list: () => apiFetch<MonthStatus[]>('/months'),
  get: (ym: string) => apiFetch<MonthStatus>(`/months/${ym}`),
  close: (ym: string) => apiFetch<MonthStatus>(`/months/${ym}/close`, json('POST')),
  reopen: (ym: string, reason: string) => apiFetch<MonthStatus>(`/months/${ym}/reopen`, json('POST', { reason })),
}

/* ---------- LGPD / audit ---------- */

export const lgpdApi = {
  exportData: () => apiFetch<unknown>('/me/data'),
  deleteAccount: () => apiFetch<void>('/me/delete', json('POST')),
}

export type AuditEvent = {
  id: string
  entityName: string
  entityId: string
  action: string
  actor: string
  timestampUtc: string
  correlationId: string
  detailsJson: string
}

export const auditApi = {
  list: (entityName?: string, entityId?: string, skip = 0, take = 50) =>
    apiFetch<Paged<AuditEvent>>(`/audit-events${query({ entityName, entityId, skip, take })}`),
}
