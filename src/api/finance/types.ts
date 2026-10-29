export type AccountKind = 'Checking' | 'Cash' | 'Other' | 'Savings' | 'Investment'

export type BudgetMode = 'Simple' | 'Detailed'

export type CategoryLevel = 'Root' | 'Group' | 'Analytical'

export type CategorySection =
  | 'Income'
  | 'Discount'
  | 'LifeProject'
  | 'Essential'
  | 'Social'
  | 'Debt'
  | 'Asset'
  | 'Liability'
  | 'Budget'
  | 'Expense'
  | 'Patrimony'

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

export type PlanKind =
  | 'Monthly1490'
  | 'Yearly14990'
  | 'IndividualMonthly'
  | 'IndividualYearly'
  | 'FamilyMonthly'
  | 'FamilyYearly'
  | 'FamilyPlusMonthly'
  | 'FamilyPlusYearly'

export type PlanTier = 'Individual' | 'Family' | 'FamilyPlus'

export type AccessPhase = 'Trial' | 'Subscribed' | 'Grace' | 'Expired' | 'Blocked'

export type SubscriptionStatus = 'Active' | 'Expired' | 'ReadOnly'

export type WhatsAppDraftStatus = 'Pending' | 'Confirmed' | 'Discarded'

export type Paged<T> = { items: T[]; skip: number; take: number; totalCount: number }

export type SharingScope = 'Personal' | 'Family'

export type Category = {
  id: string
  parentId: string | null
  name: string
  code: string | null
  displayNumber: string | null
  level: CategoryLevel
  section: CategorySection
  isSystem: boolean
  isActive: boolean
  sortOrder: number
  acceptsPosting: boolean
  sharingScope: SharingScope
  createdByUsuarioId?: string | null
  createdByName?: string | null
  isPendingReview?: boolean
}

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
  bankCode?: string
  agency?: string
  accountNumber?: string
  checkDigit?: string
}

export type CashBalance = { endYm: string; balance: number }

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
  usuarioId?: string
  postedByName?: string | null
  canEdit?: boolean
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

export type EntryUpdateInput = {
  amount: number
  occurredAt: string
  description: string
  competenceYm?: string
  accountId?: string
  contraAccountId?: string
  categoryId?: string
  incomeSourceId?: string
  memberId?: string
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
  scope?: SharingScope
}

export type Alert = {
  code: string
  severity: string
  message: string
  categoryId: string | null
  percent: number | null
  seen?: boolean
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
  byAccount: { categoryId: string | null; categoryName: string; amount: number }[]
  previousYm: string
  previousExpenseTotal: number
  expenseDelta: number
  previousResult: number
}

export type BudgetLine = {
  categoryId: string | null
  categoryName: string
  parentId: string | null
  groupName: string
  section: CategorySection
  level: CategoryLevel
  plannedAmount: number
  actualAmount: number
  remaining: number
  percent: number | null
  status: string
  isGroup: boolean
  expenseDay?: number | null
}

export type BudgetSectionBlock = {
  section: CategorySection
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
  sharingScope?: SharingScope
  canEdit?: boolean
  budgetOwnerUsuarioId?: string | null
}

export type CategoryMemberBreakdown = {
  competenceYm: string
  categoryKey: string
  categoryName: string
  scope: SharingScope
  total: number
  members: Array<{ usuarioId: string; name: string; amount: number }>
}

export type BudgetYearMonthCell = {
  competenceYm: string
  plannedAmount: number
  actualAmount: number
  receivedIncome?: number
  monthResult?: number
}

export type BudgetYearLine = {
  categoryId: string | null
  categoryName: string
  groupName: string
  section: CategorySection
  months: BudgetYearMonthCell[]
}

export type BudgetYear = {
  year: number
  months: string[]
  lines: BudgetYearLine[]
  totals: BudgetYearMonthCell[]
}

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
  categoryId: string | null
  categoryName: string | null
  horizon: LifeProjectHorizon | null
}

export type LifeProjectInput = {
  name: string
  goalAmount: number
  dueDate: string
  contributionStartYm: string
  scope: LifeProjectScope
  categoryId: string
  detailedDescription?: string
}

export type PatrimonyItem = {
  id: string
  categoryId: string
  categoryName: string
  name: string
  section: CategorySection
  groupName: string
  amount: number
}

export type PatrimonyGroupTotal = {
  groupName: string
  section: CategorySection
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
  reserveBalance: number
  monthsCovered: number
  targetMonths: number
  progressPercent: number
}

export type JourneyStep = {
  key: string
  title: string
  route: string
  completed: boolean
  isNext: boolean
}

export type Journey = {
  quietMode: boolean
  steps: JourneyStep[]
  nextStep: JourneyStep | null
}

export type Achievement = {
  key: string
  title: string
  description: string
  earned: boolean
  earnedAt: string | null
  points?: number | null
  age?: number | null
}

export type Achievements = {
  quietMode: boolean
  items: Achievement[]
}

export type ReserveThermometer = {
  referenceYm: string
  monthlyEssentialAverage: number
  monthsConsidered: number
  source: string
  reserveBalance: number
  monthsCovered: number
  targetMonths: number
  progressPercent: number
}

export type ProjectProgress = {
  id: string
  name: string
  scope: string
  goalAmount: number
  accumulatedAmount: number
  progressPercent: number
  estimatedArrival: string | null
  horizon: string | null
}

export type BudgetCloseStatus = {
  competenceYm: string
  isClosed: boolean
  hasBudget: boolean
  plannedExpense: number
  actualExpense: number
  withinBudget: boolean
}

export type HomeProgress = {
  quietMode: boolean
  nextStep: JourneyStep | null
  reserve: ReserveThermometer
  budgetClose: BudgetCloseStatus
  projects: ProjectProgress[]
  achievements: Achievement[]
}

export type MonthCloseSummary = {
  competenceYm: string
  isClosed: boolean
  closedAt: string | null
  reopenReason: string | null
  closedByUsuarioId: string | null
  incomeTotal: number
  expenseTotal: number
  result: number
  withinBudget: boolean
  quietMode: boolean
  celebrationMessage: string | null
  nextStep: JourneyStep | null
}

export type YearRetrospectiveMonth = {
  competenceYm: string
  isClosed: boolean
  withinBudget: boolean
  incomeTotal: number | null
  expenseTotal: number | null
  result: number | null
}

export type YearRetrospective = {
  year: number
  quietMode: boolean
  includeAbsoluteValues: boolean
  closedMonths: number
  withinBudgetMonths: number
  months: YearRetrospectiveMonth[]
  achievements: Achievement[]
}

export type Member = { id: string; name: string; isActive: boolean }

export type FamilyProfile = {
  usuarioId: string
  name: string
  email: string
  onboardingCompleted: boolean
  themeId: string
  quietMode: boolean
  emailsEnabled: boolean
  reserveTargetMonths: number
  monthCloseDay: number
  includeAbsoluteValuesInRetrospective: boolean
  voiceEntryConfirm: boolean
  hasAppleLogin?: boolean
  budgetAlertPercent?: number
  photoEvolutionEnabled?: boolean
  phone?: string | null
  cep?: string | null
  contractAcknowledgedAt?: string | null
}

export type LgpdExportStatus = {
  exportPending: boolean
  exportReady: boolean
  canDeleteAccount: boolean
  expiresAtUtc: string | null
  message: string
}

export type DeleteAccountInput = {
  appleAuthorizationCode?: string
  appleClient?: 'ios' | 'web'
  appleRedirectUri?: string
}

export type UserPreferencesInput = {
  themeId: string
  quietMode: boolean
  emailsEnabled: boolean
  reserveTargetMonths: number
  monthCloseDay: number
  includeAbsoluteValuesInRetrospective: boolean
  voiceEntryConfirm?: boolean
  budgetAlertPercent?: number
  photoEvolutionEnabled?: boolean
}

export type FamilyMemberUser = {
  usuarioId: string
  name: string
  email: string
  isSelf: boolean
  isBudgetOwner: boolean
}

export type FamilyOwnerTransfer = {
  id: string
  fromUsuarioId: string
  fromName: string
  toUsuarioId: string
  toName: string
  expiresAt: string
  isOpen: boolean
  isIncoming: boolean
  isAuthorized?: boolean
  authorizeUrl?: string | null
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
  budgetOwnerUsuarioId: string | null
  isBudgetOwner: boolean
  canLeave: boolean
  members: FamilyMemberUser[]
  pendingInvites: FamilyInvite[]
  notices: FamilyNotice[]
  pendingOwnerTransfer: FamilyOwnerTransfer | null
}

export type UpdateProfileInput = {
  name: string
  phone?: string | null
  cep?: string | null
}

export type PlanOffer = {
  kind: PlanKind
  tier: PlanTier
  yearly: boolean
  price: number
  monthlyEquivalent: number
  /** Extra people besides the owner; null = no plan limit. */
  maxExtraMembers: number | null
}

export type Plan = {
  plan: PlanKind | null
  tier: PlanTier | null
  yearly: boolean
  status: SubscriptionStatus
  expiresAt: string | null
  isReadOnly: boolean
  price: number | null
  phase: AccessPhase
  trialEndsAt: string
  blockAt: string
  daysLeft: number
  coveredByFamily: boolean
  offers: PlanOffer[]
  /** Hotmart / training student (90-day full trial). */
  isTrainingStudent?: boolean
  /** Student trial or paid plan — not free-tier limits. */
  hasFullAccess?: boolean
  /** Had a workspace subscription row at least once (drives Renovar vs Assinar). */
  everSubscribed?: boolean
}

export type StorePurchase = {
  channel: 1 | 2
  productId: string
  transactionId: string
  purchaseToken?: string
}

export type FeedbackStatus = 'Novo' | 'Lido' | 'Respondido'

export type FeedbackItem = {
  id: string
  usuarioId: string
  usuarioNome: string
  modulo: string
  rota?: string | null
  plataforma: 'Web' | 'iOS' | 'Android' | string
  nota: number
  comentario: string
  createdAt: string
  resposta?: string | null
  respondidoEm?: string | null
  respostaLidaEm?: string | null
}

export type ConsoleFeedbackItem = FeedbackItem & {
  status: FeedbackStatus
  lidoPorUsuarioId?: string | null
  lidoPorUsuarioNome?: string | null
  lidoEm?: string | null
  respondidoPorUsuarioId?: string | null
  respondidoPorUsuarioNome?: string | null
}

export type ConsoleFeedbackUsuarioOption = {
  usuarioId: string
  usuarioNome: string
}

export type HelpField = { name: string; description: string }

export type HelpModule = { key: string; title: string; summary: string; fields: HelpField[] }

export type Help = {
  steps: { order: number; key: string; title: string; text: string }[]
  glossary: { key: string; term: string; definition: string }[]
  modules: HelpModule[]
}

export type AiAnswer = { available: boolean; answer: string }

export type VoiceIntent = 'navigate' | 'action' | 'ask'

export type VoiceEntryDraft = {
  type: 'Expense' | 'Income' | 'ProjectContribution'
  amount: number | null
  date?: string | null
  description: string | null
  categoryName: string | null
  accountName: string | null
  projectName?: string | null
  kind?: 'entry' | 'budget'
}

export type VoiceCommand = {
  intent: VoiceIntent
  route: string | null
  action: string | null
  entry: VoiceEntryDraft | null
  reply: string
}

export type VoiceTurn = {
  role: 'user' | 'assistant'
  text: string
}

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

export type ReceiptIntakeStatus =
  | 'Processing'
  | 'NeedsClassification'
  | 'Ready'
  | 'Confirmed'
  | 'Failed'

export type ReceiptChannel = 'App' | 'ShareTarget' | 'WhatsApp'

export type ReceiptPurpose = 'Expense' | 'BudgetBoleto'

export type SimilarSupplier = {
  id: string
  cnpj: string | null
  name: string
  defaultCategoryCode: string | null
  matchReason: string
}

export type ReceiptIntake = {
  id: string
  channel: ReceiptChannel
  purpose: ReceiptPurpose
  status: ReceiptIntakeStatus
  extractedCnpj: string | null
  extractedName: string | null
  extractedAmount: number | null
  extractedOccurredAt: string | null
  supplierId: string | null
  proposedCategoryCode: string | null
  proposedCategoryId: string | null
  proposedCategoryName: string | null
  selectedBankAccountId: string | null
  failureReason: string | null
  needsClassification: boolean
  similarSuppliers: SimilarSupplier[]
  budgetCompetenceYm: string | null
}

export type BudgetBoletoConfirm = {
  intakeId: string
  competenceYm: string
  categoryId: string
  categoryName: string | null
  plannedAmount: number
  expenseDay: number | null
}

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

export type MonthStatus = {
  competenceYm: string
  isClosed: boolean
  closedAt: string | null
  reopenReason: string | null
  closedByUsuarioId: string | null
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

export type ConsoleMetric = {
  key: string
  label: string
  count: number
  base: number
  percent: number
}

export type ConsoleFeature = {
  key: string
  label: string
  users: number
  events: number
  percent: number
}

export type ConsoleWeek = {
  weekStart: string
  signups: number
  active: number
  budgets: number
  closes: number
  errors: number
}

export type ConsoleErrorRow = {
  day: string
  statusCode: number
  title: string
  area: string
  count: number
}

export type ConsoleMonth = {
  competenceYm: string
  base: number
  withBudget: number
  withoutBudget: number
  budgetWithin: number
  budgetOver: number
  budgetEmpty: number
  withEntry: number
  closed: number
  closedWithin: number
  closedOver: number
  signups: number
  errors: number
  budgetPercent: number
  withinPercent: number
  closedPercent: number
}

export type ConsoleKpis = {
  generatedAtUtc: string
  competenceYm: string
  previousCompetenceYm: string
  accounts: number
  active1d: number
  active7d: number
  active30d: number
  errors7d: number
  errors30d: number
  withBudget: number
  withoutBudget: number
  budgetWithin: number
  budgetOver: number
  budgetEmpty: number
  journey: ConsoleMetric[]
  achievements: ConsoleMetric[]
  previousMonth: ConsoleMetric[]
  features: ConsoleFeature[]
  weeks: ConsoleWeek[]
  errorDays: ConsoleMetric[]
  errorsByStatus: ConsoleMetric[]
  errorsByArea: ConsoleMetric[]
  errorRows: ConsoleErrorRow[]
  months: ConsoleMonth[]
}

export type JourneyAbandonmentRow = {
  usuarioId: string
  email: string
  name: string
  firstLoginAt: string | null
  lastSeenAt: string | null
  firstPath: string | null
  lastPath: string | null
  hasEntry: boolean
  onboardingCompleted: boolean
  pathTrail: string[]
}
