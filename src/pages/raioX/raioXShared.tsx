import { useState } from 'react'
import {
  entryDisplayDescription,
  type Budget,
  type BudgetYear,
  type Category,
  type CategorySection,
  type Entry,
} from '../../api/finance'
import { ProgressToneLegend } from '../../components/ProgressToneLegend'
import {
  categoryLabel,
} from '../../lib/categoryLabel'
import {
  isCashFlowSection,
} from '../../lib/categoryOrder'
import {
  buildBudgetMacroBars,
} from '../../lib/homeInsights'
import {
  formatCompetence,
  formatDate,
  formatMoney,
  formatPercent,
} from '../../lib/format'
import {
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
  { id: 'raiox-resumo', label: 'Resumo' },
  { id: 'raiox-previsto', label: 'Previsto' },
  { id: 'raiox-graficos', label: 'Gráficos' },
] as const

export function scrollToRaioXAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Raio-X shows only budget/entry cash-flow — never life projects or patrimony. */
export function isRaioXVisibleAccount(account: Category): boolean {
  return (
    account.section !== 'LifeProject' &&
    account.section !== 'Asset' &&
    account.section !== 'Liability' &&
    account.section !== 'Patrimony'
  )
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

export function TotalsCell({
  totals,
  stock = false,
  onUnbudgetedClick,
}: {
  totals: RaioXTotals
  stock?: boolean
  onUnbudgetedClick?: () => void
}) {
  if (stock) {
    const has = Math.abs(totals.actual) > 0.001
    return (
      <span className={styles.raioxTotals}>
        <span className={styles.raioxAmount}>—</span>
        <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>
          {has ? formatMoney(totals.actual) : '—'}
        </span>
        <span className={styles.raioxPercent}>—</span>
      </span>
    )
  }

  const percent = progressPercent(totals)
  const tone = progressTone(percent, totals)
  const shown = percent === null ? 0 : percent
  const percentClass = `${styles.raioxPercent} ${toneClass(tone)}`
  const actualClass = `${styles.raioxAmount} ${styles.moneyValue}${tone === 'over' ? ` ${styles.negative}` : ''}`
  return (
    <span className={styles.raioxTotals}>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.planned)}</span>
      <span className={actualClass}>{formatMoney(totals.actual)}</span>
      {tone === 'unbudgeted' && onUnbudgetedClick ? (
        <button
          type="button"
          className={`${percentClass} ${styles.raioxPercentLink}`}
          title="Definir orçamento desta conta"
          onClick={(event) => {
            event.stopPropagation()
            onUnbudgetedClick()
          }}
        >
          {formatPercent(shown)}
        </button>
      ) : (
        <span className={percentClass}>{formatPercent(shown)}</span>
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
        sum += Math.abs(cell.actualAmount)
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
        <span className={styles.rowSub}>{entryDisplayDescription(entry)}</span>
      </span>
      <span className={styles.raioxTotals}>
        <span className={styles.raioxAmount} />
        <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>
          {formatMoney(Math.abs(entry.amount))}
        </span>
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

/** True when the branch has planned or realized amount (hides empty R$ 0,00 noise). */
export function branchHasAmount(
  accountId: string,
  byParent: Map<string | null, Category[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
): boolean {
  const totals = sumBranch(accountId, byParent, planned, actual)
  return Math.abs(totals.planned) > 0.001 || Math.abs(totals.actual) > 0.001
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
  // Keep 3rd-level heads under Renda/Despesa (depth 1) visible for jump menu; hide empty deeper rows.
  if (
    depth >= 2 &&
    !leakageOnly &&
    !branchHasAmount(account.id, byParent, planned, actual)
  ) {
    return null
  }
  const children = (byParent.get(account.id) ?? []).filter((child) => {
    if (!isRaioXVisibleAccount(child)) {
      return false
    }
    if (leakageOnly) {
      return branchHasLeakage(child.id, byParent, planned, actual)
    }
    return branchHasAmount(child.id, byParent, planned, actual)
  })
  const launchEntries =
    account.level === 'Analytical'
      ? (entriesByAccount.get(account.id) ?? []).filter(
          (entry) => entry.type !== 'ProjectContribution' && entry.type !== 'Contribution',
        )
      : []
  const leafActual = account.level === 'Analytical' ? (actual.get(account.id) ?? 0) : 0
  const unlocked = categoryUnlocked(account)
  const lockedLeaf = freeLimited && account.level === 'Analytical' && !unlocked
  const expandable =
    !lockedLeaf && (children.length > 0 || launchEntries.length > 0 || leafActual !== 0)
  const expanded = open.has(account.id)
  const totals = sumBranch(account.id, byParent, planned, actual)
  const focused = focusClass(account.section, highlighted)
  const rowClass =
    account.level === 'Root' || account.section === 'Expense' || account.section === 'Income'
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
          if (expandable) {
            onToggle(account.id)
          }
        }}
        aria-expanded={expandable ? expanded : undefined}
        aria-disabled={lockedLeaf || undefined}
        title={lockedLeaf ? 'Liberado nos planos pagos' : undefined}
      >
        <span className={styles.raioxToggle} aria-hidden>
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>{categoryLabel(account)}</strong>
        <TotalsCell
          totals={totals}
          onUnbudgetedClick={
            unlocked && account.level === 'Analytical' ? () => onUnbudgetedClick(account.id) : undefined
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
          <span className={styles.muted}>Nenhum lançamento nesta conta.</span>
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
  monthBalance,
  focus,
  onFocus,
  months,
  ym,
}: {
  previousMonthBalance: number
  incomeActual: number
  discountActual: number
  monthBalance: number
  focus: RaioXFocus
  onFocus: (next: RaioXFocus) => void
  months: number
  ym: string
}) {
  const gastavel = incomeActual - discountActual
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
            {formatMoney(previousMonthBalance)}
          </strong>
        </div>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'income' ? styles.heroCardIncomeActive : ''}`}
          aria-pressed={focus === 'income'}
          onClick={() => onFocus('income')}
        >
          <span>Renda</span>
          <strong className={`${styles.moneyValue} ${styles.positive}`}>{formatMoney(incomeActual)}</strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'discount' ? styles.heroCardDiscountActive : ''}`}
          aria-pressed={focus === 'discount'}
          onClick={() => onFocus('discount')}
        >
          <span>Descontos</span>
          <strong className={`${styles.moneyValue} ${discountActual > 0 ? styles.negative : ''}`}>
            {formatMoney(discountActual)}
          </strong>
        </button>
        <button
          type="button"
          className={`${styles.heroCard} ${focus === 'spendable' ? styles.heroCardSpendableActive : ''}`}
          aria-pressed={focus === 'spendable'}
          onClick={() => onFocus('spendable')}
        >
          <span>Gastável</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(gastavel)}`}>
            {formatMoney(gastavel)}
          </strong>
        </button>
        <div className={`${styles.heroCard} ${styles.heroCardStatic}`}>
          <span>Saldo do mês</span>
          <strong className={`${styles.moneyValue} ${signedMoneyClass(monthBalance)}`}>
            {formatMoney(monthBalance)}
          </strong>
        </div>
      </div>
    </section>
  )
}

export function RaioXSideCards({
  budget,
  accounts,
  byParent,
  planned,
  actual,
  onExpandSection,
}: {
  budget: Budget
  accounts: Category[]
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  actual: Map<string, number>
  onExpandSection: (section: CategorySection, options?: { accountId?: string }) => void
}) {
  const [macroOpen, setMacroOpen] = useState<Set<CategorySection>>(() => new Set())
  const bars = buildBudgetMacroBars(budget).filter((bar) => isRaioXMacroSection(bar.section))

  function toggleMacroBar(section: CategorySection) {
    setMacroOpen((current) => {
      const next = new Set(current)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  return (
    <div className={styles.macroGrid}>
      <section
        id="raiox-previsto"
        className={styles.macroCard}
        aria-label="Previsto versus realizado"
      >
        <div className={styles.macroHeadRow}>
          <div className={styles.macroHead}>
            <strong>Previsto × realizado</strong>
          </div>
          <ProgressToneLegend />
        </div>
        {bars.length === 0 ? (
          <p id="raiox-graficos" className={styles.muted}>
            Sem valores de fluxo neste mês.
          </p>
        ) : (
          <ul id="raiox-graficos" className={styles.macroBars}>
            {bars.map((bar) => {
              const head = sectionHead(accounts, bar.section)
              const childAccounts = head
                ? (byParent.get(head.id) ?? []).filter(
                    (child) =>
                      isRaioXVisibleAccount(child) &&
                      branchHasAmount(child.id, byParent, planned, actual),
                  )
                : []
              const expandable = childAccounts.length > 0
              const expanded = expandable && macroOpen.has(bar.section)
              return (
                <li key={bar.section} className={styles.macroBarItem}>
                  <button
                    type="button"
                    className={styles.macroBarLink}
                    aria-expanded={expandable ? expanded : undefined}
                    onClick={() => {
                      if (expandable) {
                        const willOpen = !macroOpen.has(bar.section)
                        toggleMacroBar(bar.section)
                        if (willOpen) {
                          onExpandSection(bar.section)
                        }
                        return
                      }
                      onExpandSection(bar.section)
                    }}
                  >
                    <span className={styles.macroBarLabel}>
                      <strong>
                        {expandable ? (
                          <span className={styles.macroBarToggle} aria-hidden>
                            {expanded ? '−' : '+'}
                          </span>
                        ) : null}
                        {bar.name}
                      </strong>
                      <span className={styles.moneyValue}>
                        {consumptionLabel(bar.planned, bar.actual)}
                      </span>
                    </span>
                    <ConsumptionBar percent={bar.progressPct} color={accountBarColor(bar.section)} />
                  </button>
                  {expanded ? (
                    <ul className={styles.macroBarChildren}>
                      {childAccounts.map((child) => {
                        const totals = sumBranch(child.id, byParent, planned, actual)
                        const percent = progressPercent(totals)
                        return (
                          <li key={child.id}>
                            <button
                              type="button"
                              className={styles.macroBarChildLink}
                              onClick={() =>
                                onExpandSection(bar.section, { accountId: child.id })
                              }
                            >
                              <span className={styles.macroBarLabel}>
                                <strong>{categoryLabel(child)}</strong>
                                <span className={styles.moneyValue}>
                                  {consumptionLabel(totals.planned, totals.actual)}
                                </span>
                              </span>
                              <ConsumptionBar
                                percent={percent === null ? 0 : Math.min(100, percent)}
                                color={accountBarColor(bar.section)}
                              />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
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

export function consumptionLabel(total: number, fulfilled: number): string {
  const safeTotal = Number.isFinite(total) ? total : 0
  const safeFulfilled = Number.isFinite(fulfilled) ? fulfilled : 0
  const percent = safeTotal <= 0 ? 0 : (safeFulfilled / safeTotal) * 100
  return `${formatMoney(safeFulfilled)} de ${formatMoney(safeTotal)} · ${formatPercent(Number.isFinite(percent) ? percent : 0)}`
}

