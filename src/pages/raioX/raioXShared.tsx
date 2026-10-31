import { Link } from 'react-router-dom'
import {
  entryDisplayDescription,
  type Budget,
  type BudgetYear,
  type Category,
  type CategorySection,
  type Entry,
  type LifeProject,
} from '../../api/finance'
import { LIFE_HORIZONS } from '../../lib/lifeHorizon'
import { Loading } from '../../components/ui/Feedback'
import {
  categoryLabel,
} from '../../lib/categoryLabel'
import { isCashFlowSection } from '../../lib/categoryOrder'
import {
  formatCompetence,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatPercentValue,
  isMoneyCompact,
} from '../../lib/format'
import {
  buildRaioXPrevistoBars,
  progressPercent,
  progressTone,
  sectionHead,
  sumBranch,
  type ProgressTone,
  type RaioXFocus,
  type RaioXTotals,
} from '../../lib/raioX'
import pageStyles from '../pageStyles'
import raioStyles from './raioX.module.css'

const styles = { ...pageStyles, ...raioStyles }


export const MONTHS_MIN = 1
export const MONTHS_MAX = 24
export const MONTH_MARKS = [1, 3, 6, 12, 24] as const

export const RAIOX_ANCHORS = [
  { id: 'raiox-previsto', label: 'Previsto' },
] as const

export function scrollToRaioXAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Every chart account belongs on the Raio-X tree, including life projects and patrimony. */
export function isRaioXVisibleAccount(_account: Category): boolean {
  return true
}

export function isRaioXMacroSection(section: CategorySection): boolean {
  return section !== 'LifeProject' && isCashFlowSection(section)
}

export function focusClass(section: CategorySection, highlighted: CategorySection[]): string {
  if (!highlighted.includes(section)) {
    return ''
  }
  if (section === 'Discount') {
    return styles.raioxFocusDiscount
  }
  if (section === 'Income') {
    return styles.raioxFocusIncome
  }
  return styles.raioxFocus
}

export function toneClass(tone: ProgressTone): string {
  if (tone === 'over') {
    return styles.raioxToneOver
  }
  if (tone === 'unbudgeted') {
    return styles.raioxToneUnbudgeted
  }
  if (tone === 'muted') {
    return styles.raioxToneMuted
  }
  return styles.raioxToneOk
}

/** Green when value >= 0, red when negative (saldos e resultado). */
export function signedMoneyClass(value: number): string {
  return value < 0 ? styles.negative : styles.positive
}

/** Compact money cell: short label when large; full amount in title / aria. */
export function MoneyDisplay({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const full = formatMoney(value)
  const shown = formatMoneyCompact(value)
  const compact = isMoneyCompact(value)
  return (
    <span
      className={[
        styles.moneyDisplay,
        className,
        compact ? styles.moneyConvertedHighlight : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={compact ? full : undefined}
      aria-label={full}
    >
      {shown}
    </span>
  )
}

export function TotalsCell({
  totals,
  stock = false,
  onUnbudgetedClick,
  onActualClick,
}: {
  totals: RaioXTotals
  stock?: boolean
  onUnbudgetedClick?: () => void
  onActualClick?: () => void
}) {
  if (stock) {
    const has = Math.abs(totals.actual) > 0.001
    return (
      <span className={styles.raioxTotals}>
        <span className={styles.raioxAmount}>—</span>
        {has ? (
          <MoneyDisplay value={totals.actual} className={`${styles.raioxAmount} ${styles.moneyValue}`} />
        ) : (
          <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>—</span>
        )}
        <span className={styles.raioxPercent}>—</span>
      </span>
    )
  }

  const percent = progressPercent(totals)
  const tone = progressTone(percent, totals)
  // No planned base: show 0,0% in the unbudgeted (yellow) tone — same as the product rule.
  const shown = percent === null ? 0 : percent
  const percentClass = `${styles.raioxPercent} ${toneClass(tone)}`
  const actualClass = `${styles.raioxAmount} ${styles.moneyValue}${tone === 'over' ? ` ${styles.negative}` : ''}`
  return (
    <span className={styles.raioxTotals}>
      <MoneyDisplay value={totals.planned} className={`${styles.raioxAmount} ${styles.moneyValue}`} />
      {onActualClick && Math.abs(totals.actual) > 0.001 ? (
        <span
          className={`${actualClass} ${styles.raioxPercentLink}`}
          title={`${formatMoney(totals.actual)} — abrir lançamentos`}
          aria-label={`${formatMoney(totals.actual)}. Abrir lançamentos`}
          onClick={(event) => {
            event.stopPropagation()
            onActualClick()
          }}
        >
          {formatMoneyCompact(totals.actual)}
        </span>
      ) : (
        <MoneyDisplay value={totals.actual} className={actualClass} />
      )}
      {tone === 'unbudgeted' && onUnbudgetedClick ? (
        <span
          className={`${percentClass} ${styles.raioxPercentLink}`}
          title="Definir orçamento desta conta"
          aria-label={`${formatPercent(shown)}. Definir orçamento desta conta`}
          onClick={(event) => {
            event.stopPropagation()
            onUnbudgetedClick()
          }}
        >
          {formatPercentValue(shown)}
        </span>
      ) : (
        <span className={percentClass} aria-label={formatPercent(shown)}>
          {formatPercentValue(shown)}
        </span>
      )}
    </span>
  )
}

export function parseSectionParam(raw: string | null): CategorySection | null {
  if (!raw) {
    return null
  }
  if (
    isCashFlowSection(raw as CategorySection) ||
    raw === 'Asset' ||
    raw === 'Liability' ||
    raw === 'Expense' ||
    raw === 'Budget' ||
    raw === 'Patrimony'
  ) {
    return raw as CategorySection
  }
  return null
}

export function sumYearField(
  years: BudgetYear[],
  monthList: string[],
  field: 'receivedIncome' | 'monthResult',
): number {
  const wanted = new Set(monthList)
  let sum = 0
  for (const year of years) {
    for (const cell of year.totals) {
      if (!wanted.has(cell.competenceYm)) {
        continue
      }
      sum += cell[field] ?? 0
    }
  }
  return sum
}

export function sumYearSection(years: BudgetYear[], monthList: string[], section: CategorySection): number {
  const wanted = new Set(monthList)
  let sum = 0
  for (const year of years) {
    for (const line of year.lines) {
      if (line.section !== section) {
        continue
      }
      for (const cell of line.months) {
        if (!wanted.has(cell.competenceYm)) {
          continue
        }
        const actual = Math.abs(cell.actualAmount)
        const planned = Math.abs(cell.plannedAmount)
        sum += actual > 0.001 ? actual : planned
      }
    }
  }
  return sum
}

export function ancestorIds(accountId: string, list: Category[]): string[] {
  const byId = new Map(list.map((account) => [account.id, account]))
  const path: string[] = []
  let current = byId.get(accountId)
  while (current?.parentId) {
    path.push(current.parentId)
    current = byId.get(current.parentId)
  }
  return path
}


export function EntrySubRow({
  entry,
  depth,
  categoryName,
  accountName,
  onOpen,
}: {
  entry: Entry
  depth: number
  categoryName: string | null
  accountName: string | null
  onOpen: (entry: Entry) => void
}) {
  const headline = [categoryName, accountName, formatDate(entry.occurredAt)].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      className={`${styles.raioxRow} ${styles.raioxEntry}`}
      style={{
        paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)`,
      }}
      onClick={() => onOpen(entry)}
    >
      <span />
      <span className={styles.rowMain}>
        <strong>{headline}</strong>
        <span className={`${styles.rowSub} ${styles.raioxLaunchNote}`}>{entryDisplayDescription(entry)}</span>
      </span>
      <span className={styles.raioxTotals}>
        <span className={styles.raioxAmount} />
        <MoneyDisplay
          value={Math.abs(entry.amount)}
          className={`${styles.raioxAmount} ${styles.moneyValue}`}
        />
        <span className={styles.raioxPercent} />
      </span>
    </button>
  )
}

export function branchHasLeakage(
  accountId: string,
  byParent: Map<string | null, Category[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
): boolean {
  const children = byParent.get(accountId) ?? []
  if (children.length === 0) {
    const pct = progressPercent({
      planned: planned.get(accountId) ?? 0,
      actual: actual.get(accountId) ?? 0,
    })
    return pct !== null && pct >= 100
  }
  return children.some((child) => branchHasLeakage(child.id, byParent, planned, actual))
}

export function RaioXAccountBlock({
  account,
  depth,
  byParent,
  planned,
  actual,
  open,
  highlighted,
  entriesByAccount,
  categoryNameById,
  bankNameById,
  leakageOnly,
  freeLimited,
  categoryUnlocked,
  onToggle,
  onSelect,
  onOpenEntry,
  onOpenActual,
  onUnbudgetedClick,
}: {
  account: Category
  depth: number
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  actual: Map<string, number>
  open: Set<string>
  highlighted: CategorySection[]
  entriesByAccount: Map<string, Entry[]>
  categoryNameById: Map<string, string>
  bankNameById: Map<string, string>
  leakageOnly: boolean
  freeLimited: boolean
  categoryUnlocked: (account: Category) => boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onOpenEntry: (entry: Entry) => void
  onOpenActual: (account: Category, launchEntries: Entry[]) => void
  onUnbudgetedClick: (accountId: string) => void
}) {
  if (!isRaioXVisibleAccount(account)) {
    return null
  }
  if (leakageOnly && !branchHasLeakage(account.id, byParent, planned, actual)) {
    return null
  }
  const children = (byParent.get(account.id) ?? []).filter((child) => {
    if (!isRaioXVisibleAccount(child)) {
      return false
    }
    if (leakageOnly) {
      return branchHasLeakage(child.id, byParent, planned, actual)
    }
    return true
  })
  const launchEntries = account.level === 'Analytical' ? (entriesByAccount.get(account.id) ?? []) : []
  const leafActual = account.level === 'Analytical' ? (actual.get(account.id) ?? 0) : 0
  const unlocked = categoryUnlocked(account)
  const lockedLeaf = freeLimited && account.level === 'Analytical' && !unlocked
  const expandable =
    !lockedLeaf && (children.length > 0 || launchEntries.length > 0 || leafActual !== 0)
  const expanded = open.has(account.id)
  const totals = sumBranch(account.id, byParent, planned, actual)
  const focused = focusClass(account.section, highlighted)
  const rowClass =
    account.level === 'Root'
      ? styles.raioxRoot
      : account.level === 'Group'
        ? styles.raioxGroup
        : styles.raioxLeaf

  return (
    <>
      <button
        type="button"
        id={`raiox-account-${account.id}`}
        className={`${styles.raioxRow} ${rowClass} ${focused}${lockedLeaf ? ` ${styles.muted}` : ''}`}
        style={{
          paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)`,
          opacity: lockedLeaf ? 0.55 : undefined,
          cursor: lockedLeaf ? 'default' : undefined,
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (lockedLeaf) {
            return
          }
          const target = event.target as HTMLElement | null
          if (expandable && (account.level !== 'Analytical' || target?.closest(`.${styles.raioxToggle}`))) {
            onToggle(account.id)
          }
        }}
        aria-expanded={expandable ? expanded : undefined}
        aria-disabled={lockedLeaf || undefined}
        title={lockedLeaf ? 'Liberado nos planos pagos' : undefined}
      >
        <span
          className={styles.raioxToggle}
          aria-hidden={!expandable}
          role={expandable ? 'presentation' : undefined}
        >
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>{categoryLabel(account)}</strong>
        <TotalsCell
          totals={totals}
          onUnbudgetedClick={
            unlocked && account.level === 'Analytical' ? () => onUnbudgetedClick(account.id) : undefined
          }
          onActualClick={
            unlocked && account.level === 'Analytical'
              ? () => onOpenActual(account, launchEntries)
              : undefined
          }
        />
      </button>
      {expanded
        ? children.map((child) => (
            <RaioXAccountBlock
              key={child.id}
              account={child}
              depth={depth + 1}
              byParent={byParent}
              planned={planned}
              actual={actual}
              open={open}
              highlighted={highlighted}
              entriesByAccount={entriesByAccount}
              categoryNameById={categoryNameById}
              bankNameById={bankNameById}
              leakageOnly={leakageOnly}
              freeLimited={freeLimited}
              categoryUnlocked={categoryUnlocked}
              onToggle={onToggle}
              onSelect={onSelect}
              onOpenEntry={onOpenEntry}
              onOpenActual={onOpenActual}
              onUnbudgetedClick={onUnbudgetedClick}
            />
          ))
        : null}
      {expanded && unlocked
        ? launchEntries.map((entry) => (
            <EntrySubRow
              key={entry.id}
              entry={entry}
              depth={depth}
              categoryName={entry.categoryId ? (categoryNameById.get(entry.categoryId) ?? null) : null}
              accountName={entry.accountId ? (bankNameById.get(entry.accountId) ?? null) : null}
              onOpen={onOpenEntry}
            />
          ))
        : null}
      {expanded && account.level === 'Analytical' && children.length === 0 && launchEntries.length === 0 ? (
        <div
          className={`${styles.raioxRow} ${styles.raioxEntry}`}
          style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
        >
          <span />
          <span className={`${styles.muted} ${styles.raioxLaunchNote}`}>Nenhum lançamento nesta conta.</span>
          <span />
        </div>
      ) : null}
    </>
  )
}

export function RaioXHero({
  previousMonthBalance,
  incomeActual,
  discountActual,
  discountForSpendable,
  discountIsPlannedOnly = false,
  monthBalance,
  focus,
  onFocus,
  months,
  ym,
}: {
  previousMonthBalance: number
  incomeActual: number
  discountActual: number
  /** Realized discounts only — used for Gastável so planned INSS/IR are not double-counted. */
  discountForSpendable?: number
  discountIsPlannedOnly?: boolean
  monthBalance: number
  focus: RaioXFocus
  onFocus: (next: RaioXFocus) => void
  months: number
  ym: string
}) {
  const gastavel = incomeActual - (discountForSpendable ?? discountActual)
  const periodLabel = months === 1 ? formatCompetence(ym) : `${months} meses até ${formatCompetence(ym)}`

  return (
    <section
      id="raiox-resumo"
      className={styles.hero}
      aria-label={`Resumo · ${periodLabel}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={`${styles.heroCards} ${styles.heroCardsRaioX}`} aria-label="Indicadores do Raio-X">
        <div className={`${styles.heroCard} ${styles.heroCardStatic}`}>
          <span>Saldo anterior</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(previousMonthBalance)}`}>
            <MoneyDisplay value={previousMonthBalance} />
          </strong>
        </div>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'income' ? styles.heroCardIncomeActive : ''}`}
          aria-pressed={focus === 'income'}
          onClick={() => onFocus('income')}
        >
          <span>Renda</span>
          <strong className={`${styles.moneyValue} ${styles.positive}`}>
            <MoneyDisplay value={incomeActual} />
          </strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'discount' ? styles.heroCardDiscountActive : ''}`}
          aria-pressed={focus === 'discount'}
          onClick={() => onFocus('discount')}
        >
          <span>
            {discountIsPlannedOnly ? 'Descontos sobre renda (previsto)' : 'Descontos sobre renda'}
          </span>
          <strong className={`${styles.moneyValue} ${discountActual > 0 ? styles.negative : ''}`}>
            <MoneyDisplay value={discountActual} />
          </strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${styles.heroCardGastavel}${focus === 'spendable' ? ` ${styles.heroCardSpendableActive}` : ''}`}
          aria-pressed={focus === 'spendable'}
          onClick={() => onFocus('spendable')}
        >
          <span>Gastável</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(gastavel)}`}>
            <MoneyDisplay value={gastavel} />
          </strong>
        </button>
        <div className={`${styles.heroCard} ${styles.heroCardStatic}`}>
          <span>Saldo do mês</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(monthBalance)}`}>
            <MoneyDisplay value={monthBalance} />
          </strong>
        </div>
      </div>
    </section>
  )
}

function sectionTotals(
  accounts: Category[],
  byParent: Map<string | null, Category[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
  section: CategorySection,
): RaioXTotals {
  const head = sectionHead(accounts, section)
  if (!head) return { planned: 0, actual: 0 }
  return sumBranch(head.id, byParent, planned, actual)
}

const HORIZON_BAR_COLOR: Record<string, string> = {
  short: '#3F8F82',
  medium: '#5C7194',
  long: '#A6843A',
}

function PairCard({
  label,
  totals,
  active,
  amountClass,
  note,
  onClick,
}: {
  label: string
  totals: RaioXTotals
  active: boolean
  amountClass: string
  note?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.heroCard} ${active ? styles.heroCardPatrimonyActive : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>{label}</span>
      <strong className={`${styles.moneyValue} ${amountClass}`}>
        <MoneyDisplay value={totals.actual} />
      </strong>
      <span className={`${styles.muted} ${styles.pairCardMeta}`}>
        <span title={formatMoney(totals.planned)}>{formatMoneyCompact(totals.planned)} prev</span>
        {' · '}
        <span title={formatMoney(totals.actual)}>{formatMoneyCompact(totals.actual)} real</span>
      </span>
      {note ? <span className={styles.muted}>{note}</span> : null}
    </button>
  )
}

export function RaioXSideCards({
  accounts,
  byParent,
  planned,
  actual,
  projects,
  projectsLoading,
  scope,
  focus,
  onFocus,
  onExpandSection,
}: {
  budget: Budget
  accounts: Category[]
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  actual: Map<string, number>
  projects: LifeProject[]
  projectsLoading: boolean
  scope: 'Family' | 'Personal'
  focus: RaioXFocus
  onFocus: (next: RaioXFocus) => void
  onExpandSection: (section: CategorySection, options?: { accountId?: string }) => void
}) {
  const bars = buildRaioXPrevistoBars(accounts, byParent, planned, actual)

  const assets = sectionTotals(accounts, byParent, planned, actual, 'Asset')
  const liabilities = sectionTotals(accounts, byParent, planned, actual, 'Liability')
  const net = {
    planned: assets.planned - liabilities.planned,
    actual: assets.actual - liabilities.actual,
  }
  const patrimonyActive = focus === 'patrimony'

  const filteredProjects = projects.filter((project) =>
    scope === 'Family' ? true : project.scope === 'Personal',
  )

  return (
    <div className={styles.macroGrid}>
      <section
        id="raiox-previsto"
        className={styles.macroCard}
        aria-label="Previsto versus realizado"
      >
        <div className={styles.macroHeadRow}>
          <strong>Previsto × realizado</strong>
        </div>
        <div className={styles.macroAmountsHead} aria-hidden>
          <span />
          <span>Previsto</span>
          <span>Realizado</span>
          <span>%</span>
        </div>
        {bars.length === 0 ? (
          <p id="raiox-graficos" className={styles.muted}>
            Sem valores de fluxo neste mês.
          </p>
        ) : (
          <ul id="raiox-graficos" className={styles.macroBars}>
            {bars.map((bar) => (
              <li key={bar.categoryId} className={styles.macroBarItem}>
                <button
                  type="button"
                  className={styles.macroBarLink}
                  onClick={() => onExpandSection(bar.section, { accountId: bar.categoryId })}
                >
                  <span className={styles.macroBarLabel}>
                    <strong>{bar.name}</strong>
                    <MacroAmounts planned={bar.planned} actual={bar.actual} />
                  </span>
                  <ConsumptionBar percent={bar.progressPct} color={accountBarColor(bar.section)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className={styles.macroSplit}>
        <section className={styles.macroCard} aria-label="Patrimônio" onClick={(event) => event.stopPropagation()}>
          <div className={styles.macroHead}>
            <strong>Patrimônio</strong>
          </div>
          <div className={styles.heroCards}>
            <PairCard
              label="Ativo"
              totals={assets}
              active={patrimonyActive}
              amountClass={styles.positive}
              onClick={() => onFocus('patrimony')}
            />
            <PairCard
              label="Passivo"
              totals={liabilities}
              active={patrimonyActive}
              amountClass={styles.negative}
              onClick={() => onFocus('patrimony')}
            />
            <PairCard
              label="Patrimônio líquido"
              totals={net}
              active={patrimonyActive}
              amountClass={net.actual < 0 ? styles.negative : ''}
              note="Ativo − passivo"
              onClick={() => onFocus('patrimony')}
            />
          </div>
        </section>
        <section
          className={styles.macroCard}
          aria-label="Projetos de vida"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.macroHead}>
            <strong>Projetos de vida</strong>
          </div>
          {projectsLoading ? <Loading /> : null}
          {LIFE_HORIZONS.map((horizon) => {
            const items = filteredProjects.filter((project) => project.horizon === horizon.key)
            const goal = items.reduce((sum, project) => sum + project.goalAmount, 0)
            const accumulated = items.reduce((sum, project) => sum + project.accumulatedAmount, 0)
            const percent = goal <= 0 ? 0 : Math.min(100, (accumulated / goal) * 100)
            return (
              <Link key={horizon.key} className={styles.horizonRow} to={`/projetos?horizonte=${horizon.key}`}>
                <span className={styles.horizonMeta}>
                  <strong>{horizon.label}</strong>
                  <MacroAmounts planned={goal} actual={accumulated} />
                </span>
                <ConsumptionBar percent={percent} color={HORIZON_BAR_COLOR[horizon.key] ?? '#5B7194'} />
              </Link>
            )
          })}
        </section>
      </div>
    </div>
  )
}

export const ACCOUNT_BAR_COLOR = {
  Income: '#2F8A78',
  Discount: '#5B7194',
  Debt: '#B85C6A',
  Essential: '#3F5E8C',
  Social: '#7A5A94',
} as const

export function accountBarColor(section: CategorySection): string {
  if (section in ACCOUNT_BAR_COLOR) {
    return ACCOUNT_BAR_COLOR[section as keyof typeof ACCOUNT_BAR_COLOR]
  }
  return '#5B7194'
}

export function ConsumptionBar({ percent, color }: { percent: number; color: string }) {
  return (
    <span
      className={styles.progress}
      aria-hidden
      style={{ background: `color-mix(in srgb, ${color} 32%, var(--border-subtle))` }}
    >
      <span
        className={styles.progressFill}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
      />
    </span>
  )
}

export function MacroAmounts({ planned, actual }: { planned: number; actual: number }) {
  const safePlanned = Number.isFinite(planned) ? planned : 0
  const safeActual = Number.isFinite(actual) ? actual : 0
  const percent = safePlanned <= 0 ? 0 : (safeActual / safePlanned) * 100
  const safePercent = Number.isFinite(percent) ? percent : 0
  return (
    <span
      className={styles.macroAmounts}
      aria-label={`${formatMoney(safeActual)} de ${formatMoney(safePlanned)}, ${formatPercent(safePercent)}`}
    >
      <MoneyDisplay value={safePlanned} className={styles.macroAmountCell} />
      <MoneyDisplay value={safeActual} className={styles.macroAmountCell} />
      <span className={styles.macroAmountPct} aria-label={formatPercent(safePercent)}>
        {formatPercentValue(safePercent)}
      </span>
    </span>
  )
}

/** @deprecated Prefer MacroAmounts for layout; kept for tests that assert the string. */
export function consumptionLabel(total: number, fulfilled: number): string {
  const safeTotal = Number.isFinite(total) ? total : 0
  const safeFulfilled = Number.isFinite(fulfilled) ? fulfilled : 0
  const percent = safeTotal <= 0 ? 0 : (safeFulfilled / safeTotal) * 100
  return `${formatMoneyCompact(safeFulfilled)} de ${formatMoneyCompact(safeTotal)} · ${formatPercent(Number.isFinite(percent) ? percent : 0)}`
}

