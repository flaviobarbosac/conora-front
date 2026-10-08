import { apiBlob, apiFetch } from './client'

/* ---------- Enums (serialized as strings by the API) ---------- */

export type AccountKind = 'Checking' | 'Cash' | 'Other' | 'Savings' | 'Investment'
export type BudgetMode = 'Simple' | 'Detailed'
export type ChartAccountLevel = 'Root' | 'Group' | 'Analytical'
export type ChartSection =
  | 'Income'
  | 'Discount'
  | 'LifeProject'
  | 'Essential'
  | 'Social'
  | 'Asset'
  | 'Liability'
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

/* ---------- Chart of accounts ---------- */

export type ChartAccount = {
  id: string
  parentId: string | null
  name: string
  code: string | null
  displayNumber: string | null
  level: ChartAccountLevel
  section: ChartSection
  isSystem: boolean
  isActive: boolean
  sortOrder: number
  acceptsPosting: boolean
}

export const chartAccountsApi = {
  list: (section?: ChartSection, includeInactive = false, analyticalOnly = false) =>
    apiFetch<ChartAccount[]>(`/chart-accounts${query({ section, includeInactive, analyticalOnly })}`),
  create: (name: string, parentId: string) =>
    apiFetch<ChartAccount>('/chart-accounts', json('POST', { name, parentId })),
  update: (id: string, name: string, isActive: boolean) =>
    apiFetch<ChartAccount>(`/chart-accounts/${id}`, json('PUT', { name, isActive })),
  remove: (id: string) => apiFetch<void>(`/chart-accounts/${id}`, json('DELETE')),
}

/** @deprecated alias while pages migrate */
export type Category = ChartAccount
export const categoriesApi = chartAccountsApi

/* ---------- Accounts ---------- */

export type Account = {
  id: string
  name: string
  kind: AccountKind
  balance: number
  isArchived: boolean
  bankCode: string | null
  agency: string | null
  accountNumber: string | null
  checkDigit: string | null
  bankName: string | null
}

export type BankOption = { code: string; name: string }

export type CreateAccountInput = {
  name: string
  kind: AccountKind
  openingBalance: number
  bankCode?: string
  agency?: string
  accountNumber?: string
  checkDigit?: string
}

export const accountsApi = {
  list: (includeArchived = false) => apiFetch<Account[]>(`/accounts${query({ includeArchived })}`),
  banks: () => apiFetch<BankOption[]>('/accounts/banks'),
  create: (input: CreateAccountInput) => apiFetch<Account>('/accounts', json('POST', input)),
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
  chartAccountId: string
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
  chartAccountId: string | null
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
  chartAccountId?: string
  memberId?: string
  installmentCount?: number
  repeatMonths?: number
  confirmDuplicate?: boolean
}

export type EntryFilter = {
  competenceYm?: string
  type?: EntryType
  chartAccountId?: string
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
  suggestAccount: (description: string) =>
    apiFetch<{ chartAccountId: string | null; chartAccountName: string | null }>(
      `/entries/suggest-account${query({ description })}`,
    ),
}

/* ---------- Dashboard / reports ---------- */

export type Alert = {
  code: string
  severity: string
  message: string
  chartAccountId: string | null
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
  byAccount: { chartAccountId: string | null; chartAccountName: string; amount: number }[]
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
  chartAccountId: string | null
  chartAccountName: string
  parentId: string | null
  groupName: string
  section: ChartSection
  level: ChartAccountLevel
  plannedAmount: number
  actualAmount: number
  remaining: number
  percent: number | null
  status: string
  isGroup: boolean
}

export type BudgetSectionBlock = {
  section: ChartSection
  name: string
  plannedAmount: number
  actualAmount: number
  percentOfSpendable: number | null
  lines: BudgetLine[]
}

export type BudgetIncomeSource = {
  id: string
  name: string
  netSpendable: number
}

export type Budget = {
  competenceYm: string
  mode: BudgetMode
  totalPlanned: number
  totalActual: number
  projectedExpense: number
  spendableIncome: number
  receivedIncome: number
  monthResult: number
  incomeSources: BudgetIncomeSource[]
  sections: BudgetSectionBlock[]
  lines: BudgetLine[]
}

export type BudgetYearMonthCell = {
  competenceYm: string
  plannedAmount: number
  actualAmount: number
}

export type BudgetYearLine = {
  chartAccountId: string | null
  chartAccountName: string
  groupName: string
  section: ChartSection
  months: BudgetYearMonthCell[]
}

export type BudgetYear = {
  year: number
  months: string[]
  lines: BudgetYearLine[]
  totals: BudgetYearMonthCell[]
}

export const budgetsApi = {
  get: (ym: string) => apiFetch<Budget>(`/budgets/${ym}`),
  getYear: (year: number) => apiFetch<BudgetYear>(`/budgets/year/${year}`),
  upsert: (ym: string, mode: BudgetMode, lines: { chartAccountId: string; plannedAmount: number }[]) =>
    apiFetch<Budget>(`/budgets/${ym}`, json('PUT', { mode, lines })),
  copyPrevious: (ym: string) => apiFetch<Budget>(`/budgets/${ym}/copy-previous`, json('POST')),
  removeLine: (ym: string, chartAccountId: string) =>
    apiFetch<void>(`/budgets/${ym}/lines/${chartAccountId}`, json('DELETE')),
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

export type LifeProjectScope = 'Personal' | 'Group'

export type LifeProjectHorizon = 'short' | 'mid' | 'long'

export type LifeProject = {
  id: string
  name: string
  detailedDescription: string | null
  goalAmount: number
  dueDate: string
  contributionStartYm: string
  accumulatedAmount: number
  progressPercent: number
  scope: LifeProjectScope
  isOwner: boolean
  chartAccountId: string | null
  chartAccountName: string | null
  horizon: LifeProjectHorizon | null
}

export type LifeProjectInput = {
  name: string
  goalAmount: number
  dueDate: string
  contributionStartYm: string
  scope: LifeProjectScope
  chartAccountId: string
  detailedDescription?: string
}

export const projectsApi = {
  list: () => apiFetch<LifeProject[]>('/life-projects'),
  get: (id: string) => apiFetch<LifeProject>(`/life-projects/${id}`),
  create: (input: LifeProjectInput) =>
    apiFetch<LifeProject>('/life-projects', json('POST', input)),
  update: (id: string, input: LifeProjectInput) =>
    apiFetch<LifeProject>(`/life-projects/${id}`, json('PUT', input)),
  remove: (id: string) => apiFetch<void>(`/life-projects/${id}`, json('DELETE')),
  contribute: (
    id: string,
    input: { amount: number; occurredAt: string; accountId: string; chartAccountId: string; description?: string },
  ) => apiFetch<unknown>(`/life-projects/${id}/contributions`, json('POST', input)),
}

/* ---------- Patrimony ---------- */

export type PatrimonyItem = {
  id: string
  chartAccountId: string
  chartAccountName: string
  name: string
  section: ChartSection
  groupName: string
  amount: number
}

export type PatrimonyGroupTotal = {
  groupName: string
  section: ChartSection
  amount: number
}

export type PatrimonySummary = {
  accountsBalance: number
  assetsTotal: number
  assetsInUse: number
  assetsNotInUse: number
  unpaidCardInvoices: number
  liabilitiesTotal: number
  netWorth: number
  groups: PatrimonyGroupTotal[]
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
  create: (chartAccountId: string, name: string, amount: number) =>
    apiFetch<PatrimonyItem>('/patrimony/items', json('POST', { chartAccountId, name, amount })),
  update: (id: string, name: string, amount: number) =>
    apiFetch<PatrimonyItem>(`/patrimony/items/${id}`, json('PUT', { name, amount })),
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

/* ---------- Family group ---------- */

export type FamilyProfile = {
  usuarioId: string
  name: string
  email: string
}

export type FamilyMemberUser = {
  usuarioId: string
  name: string
  email: string
  isSelf: boolean
}

export type FamilyInvite = {
  id: string
  email: string
  expiresAt: string
  acceptedAt: string | null
  cancelledAt: string | null
  isOpen: boolean
}

export type FamilyInvitePreview = {
  status: string
  inviterName: string
  email: string
  expiresAt: string | null
}

export type FamilyNotice = {
  id: string
  kind: string
  message: string
  createdAt: string
  isRead: boolean
}

export type FamilyGroupResponse = {
  groupId: string | null
  members: FamilyMemberUser[]
  pendingInvites: FamilyInvite[]
  notices: FamilyNotice[]
}

export const familyApi = {
  profile: () => apiFetch<FamilyProfile>('/family/profile'),
  updateProfile: (name: string) => apiFetch<FamilyProfile>('/family/profile', json('PUT', { name })),
  group: () => apiFetch<FamilyGroupResponse>('/family/group'),
  invite: (email: string) => apiFetch<FamilyInvite>('/family/invites', json('POST', { email })),
  cancelInvite: (id: string) => apiFetch<void>(`/family/invites/${id}`, json('DELETE')),
  previewInvite: (token: string) =>
    apiFetch<FamilyInvitePreview>(`/family/invites/${token}/preview`, { auth: false }),
  acceptInvite: (token: string) => apiFetch<FamilyGroupResponse>(`/family/invites/${token}/accept`, json('POST')),
  leave: () => apiFetch<FamilyGroupResponse>('/family/leave', json('POST')),
  removeMember: (usuarioId: string) => apiFetch<FamilyGroupResponse>(`/family/members/${usuarioId}`, json('DELETE')),
  readNotice: (id: string) => apiFetch<void>(`/family/notices/${id}/read`, json('POST')),
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

export type HelpField = { name: string; description: string }
export type HelpModule = { key: string; title: string; summary: string; fields: HelpField[] }
export type Help = {
  steps: { order: number; key: string; title: string; text: string }[]
  glossary: { key: string; term: string; definition: string }[]
  modules: HelpModule[]
}

export const helpApi = {
  get: () => apiFetch<Help>('/help'),
  module: (key: string) => apiFetch<HelpModule>(`/help/modules/${key}`),
}

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
  confirm: (id: string, accountId?: string, chartAccountId?: string) =>
    apiFetch<unknown>(`/whatsapp/drafts/${id}/confirm`, json('POST', { accountId, chartAccountId })),
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
  commit: (batchId: string, accountId: string, defaultExpenseChartAccountId?: string, defaultIncomeChartAccountId?: string) =>
    apiFetch<{ batchId: string; imported: number; skipped: number }>(
      `/imports/${batchId}/commit`,
      json('POST', { accountId, defaultExpenseChartAccountId, defaultIncomeChartAccountId }),
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
