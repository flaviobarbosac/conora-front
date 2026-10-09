import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import {
  budgetsApi,
  chartAccountsApi,
  type Budget,
  type BudgetYear,
  type ChartAccount,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty, useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { chartAccountLabel } from '../lib/chartLabel'
import { CASH_FLOW_SECTIONS, compareChartSiblings } from '../lib/chartOrder'
import {
  currentCompetence,
  formatCompetence,
  formatMoney,
  formatMoneyInput,
  parseMoney,
} from '../lib/format'
import {
  buildAmountMaps,
  groupAccountsByParent,
  progressPercent,
  progressTone,
  sumBranch,
  type ProgressTone,
  type RaioXTotals,
} from '../lib/raioX'
import styles from './page.module.css'

function toneClass(tone: ProgressTone): string {
  if (tone === 'over') {
    return styles.raioxToneOver
  }
  if (tone === 'muted') {
    return styles.raioxToneMuted
  }
  return styles.raioxToneOk
}

export function BudgetPage() {
  const [ym, setYm] = useState(currentCompetence)
  const { confirmLeave, isDirty } = useUnsavedChanges()
  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const year = useMemo(() => Number(ym.slice(0, 4)), [ym])
  const yearData = useLoad(() => budgetsApi.getYear(year), [year])
  const categories = useLoad(() => chartAccountsApi.list(undefined, false, false), [])
  const copy = useAction()

  async function changeYm(next: string) {
    if (next === ym) {
      return
    }
    if (isDirty && !(await confirmLeave())) {
      return
    }
    setYm(next)
  }

  async function copyPrevious() {
    if (isDirty && !(await confirmLeave())) {
      return
    }
    if (await copy.run(() => budgetsApi.copyPrevious(ym))) {
      budget.reload()
      yearData.reload()
    }
  }

  const data = budget.data

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Planejamento"
        title="Orçamento"
        actions={
          <>
            <CompetencePicker value={ym} onChange={(next) => void changeYm(next)} />
            <Button variant="secondary" disabled={copy.busy} onClick={() => void copyPrevious()}>
              Copiar mês anterior
            </Button>
          </>
        }
      />
      <ErrorText message={budget.error ?? copy.error ?? categories.error ?? yearData.error} />
      {budget.loading && !data ? <Loading /> : null}
      {data ? (
        <BudgetTreeEditor
          ym={ym}
          budget={data}
          categories={categories.data ?? []}
          year={year}
          yearData={yearData.data}
          yearLoading={yearData.loading}
          onSaved={() => {
            budget.reload()
            yearData.reload()
          }}
        />
      ) : null}
    </div>
  )
}

type EditorProps = {
  ym: string
  budget: Budget
  categories: ChartAccount[]
  year: number
  yearData: BudgetYear | null | undefined
  yearLoading: boolean
  onSaved: () => void
}

function BudgetTreeEditor({ ym, budget, categories, year, yearData, yearLoading, onSaved }: EditorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [toast, setToast] = useState(false)
  const [yearAccountId, setYearAccountId] = useState<string | null>(null)
  const saveAction = useAction()

  const cashAccounts = useMemo(
    () =>
      categories.filter(
        (account) => CASH_FLOW_SECTIONS.includes(account.section) && account.isActive,
      ),
    [categories],
  )

  const byParent = useMemo(() => {
    const map = groupAccountsByParent(cashAccounts)
    for (const bucket of map.values()) {
      bucket.sort(compareChartSiblings)
    }
    return map
  }, [cashAccounts])

  const roots = useMemo(
    () =>
      CASH_FLOW_SECTIONS.map((section) =>
        cashAccounts.find((account) => account.level === 'Root' && account.section === section),
      ).filter(Boolean) as ChartAccount[],
    [cashAccounts],
  )

  const { planned, actual } = useMemo(() => buildAmountMaps(budget.lines), [budget.lines])

  const plannedSignature = useMemo(
    () =>
      [...planned.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, amount]) => `${id}=${amount}`)
        .join('|'),
    [planned],
  )

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const [id, amount] of planned.entries()) {
      initial[id] = formatMoneyInput(amount)
    }
    setDrafts(initial)
    setPendingId(null)
    saveAction.setError(null)
  }, [ym, plannedSignature])

  const dirtyIds = useMemo(() => {
    const dirty = new Set<string>()
    for (const [id, text] of Object.entries(drafts)) {
      const server = planned.get(id) ?? 0
      const parsed = text.trim() ? parseMoney(text) : 0
      if (!Number.isFinite(parsed)) {
        continue
      }
      if (Math.abs(parsed - server) > 0.001) {
        dirty.add(id)
      }
    }
    return dirty
  }, [drafts, planned])

  useRegisterDirty('budget-tree', dirtyIds.size > 0)

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => setToast(false), 2000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? new Set(
        cashAccounts
          .filter((account) => chartAccountLabel(account).toLowerCase().includes(needle))
          .map((account) => account.id),
      )
    : null

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function saveLine(accountId: string) {
    const text = drafts[accountId] ?? ''
    const parsed = text.trim() ? parseMoney(text) : 0
    if (!Number.isFinite(parsed) || parsed < 0) {
      saveAction.setError('Informe um valor válido (zero ou positivo).')
      return
    }
    const server = planned.get(accountId) ?? 0
    if (Math.abs(parsed - server) < 0.001) {
      return
    }
    setPendingId(accountId)
    const ok = await saveAction.run(() =>
      budgetsApi.upsert(ym, 'Detailed', [{ chartAccountId: accountId, plannedAmount: parsed }]),
    )
    setPendingId(null)
    if (ok) {
      setToast(true)
      onSaved()
    }
  }

  const yearAccount = yearAccountId ? cashAccounts.find((account) => account.id === yearAccountId) : null
  const yearLine = yearAccountId
    ? yearData?.lines.find((line) => line.chartAccountId === yearAccountId)
    : null

  return (
    <section className={styles.section}>
      <p className={styles.muted}>
        Informe o previsto em cada conta. O valor grava ao sair do campo. Toque no nome para ver o ano. Realizado vem
        dos lançamentos.
      </p>
      <Field
        label="Buscar conta"
        name="budgetSearch"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nome da conta"
      />
      <ErrorText message={saveAction.error} />
      {roots.length === 0 ? <Loading /> : null}
      {roots.length > 0 ? (
        <div className={styles.raioxList}>
          <div className={`${styles.raioxRow} ${styles.raioxHead}`}>
            <span />
            <span>Conta</span>
            <span className={styles.raioxTotals}>
              <span>Realizado</span>
              <span>Previsto</span>
              <span>% do previsto</span>
            </span>
          </div>
          {roots.map((root) => (
            <BudgetAccountBlock
              key={root.id}
              account={root}
              depth={0}
              byParent={byParent}
              planned={planned}
              actual={actual}
              drafts={drafts}
              open={open}
              matches={matches}
              pendingId={pendingId}
              busy={saveAction.busy}
              onToggle={toggle}
              onOpenYear={setYearAccountId}
              onDraftChange={(id, value) => setDrafts((current) => ({ ...current, [id]: value }))}
              onSaveLine={(id) => void saveLine(id)}
            />
          ))}
        </div>
      ) : null}
      {yearAccount ? (
        <BudgetYearSheet
          year={year}
          account={yearAccount}
          months={yearData?.months ?? []}
          line={yearLine}
          loading={yearLoading && !yearData}
          onClose={() => setYearAccountId(null)}
        />
      ) : null}
      {toast ? (
        <div className={styles.toastOk} role="status">
          Registro salvo com sucesso.
        </div>
      ) : null}
    </section>
  )
}

function BudgetTotalsCell({
  totals,
  edit,
}: {
  totals: RaioXTotals
  edit?: ReactNode
}) {
  const percent = progressPercent(totals)
  const tone = progressTone(percent, totals)
  return (
    <span className={styles.raioxTotals}>
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.actual)}</span>
      {edit ?? (
        <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.planned)}</span>
      )}
      <span className={`${styles.raioxPercent} ${toneClass(tone)}`}>
        {percent === null ? '—' : formatPercent(percent)}
      </span>
    </span>
  )
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
}

function BudgetAccountBlock({
  account,
  depth,
  byParent,
  planned,
  actual,
  drafts,
  open,
  matches,
  pendingId,
  busy,
  onToggle,
  onOpenYear,
  onDraftChange,
  onSaveLine,
}: {
  account: ChartAccount
  depth: number
  byParent: Map<string | null, ChartAccount[]>
  planned: Map<string, number>
  actual: Map<string, number>
  drafts: Record<string, string>
  open: Set<string>
  matches: Set<string> | null
  pendingId: string | null
  busy: boolean
  onToggle: (id: string) => void
  onOpenYear: (id: string) => void
  onDraftChange: (id: string, value: string) => void
  onSaveLine: (id: string) => void
}) {
  const children = byParent.get(account.id) ?? []
  const groups = children.filter((child) => child.level === 'Group')
  const leaves = children.filter((child) => child.level === 'Analytical')
  const expandable = groups.length > 0 || leaves.length > 0
  const expanded = open.has(account.id) || Boolean(matches)
  const totals = sumBranch(account.id, byParent, planned, actual)
  const rowClass =
    account.level === 'Root'
      ? styles.raioxRoot
      : account.level === 'Group'
        ? styles.raioxGroup
        : styles.raioxLeaf

  const visibleLeaves = leaves.filter((leaf) => !matches || matches.has(leaf.id))
  const visibleGroups = groups.filter((group) => groupHasMatch(group.id, byParent, matches))

  if (
    matches &&
    account.level !== 'Root' &&
    !matches.has(account.id) &&
    visibleLeaves.length === 0 &&
    visibleGroups.length === 0
  ) {
    return null
  }

  if (account.level === 'Analytical') {
    const draft = drafts[account.id] ?? formatMoneyInput(planned.get(account.id) ?? 0)
    const lineTotals = {
      planned: Math.abs(parseMoney(draft) || 0) || (planned.get(account.id) ?? 0),
      actual: actual.get(account.id) ?? 0,
    }
    return (
      <div
        className={`${styles.raioxRow} ${rowClass}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
      >
        <span />
        <button type="button" className={styles.budgetAccountName} onClick={() => onOpenYear(account.id)}>
          <strong className={styles.raioxAccountName}>{chartAccountLabel(account)}</strong>
        </button>
        <BudgetTotalsCell
          totals={{ planned: planned.get(account.id) ?? 0, actual: lineTotals.actual }}
          edit={
            <span className={styles.raioxBudgetField}>
              <MoneyField
                compact
                label={`Orçamento ${chartAccountLabel(account)}`}
                name={`budget-${account.id}`}
                value={draft}
                disabled={busy && pendingId === account.id}
                onChange={(value) => onDraftChange(account.id, value)}
                onCommit={() => onSaveLine(account.id)}
              />
            </span>
          }
        />
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.raioxRow} ${rowClass}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
        onClick={() => (expandable ? onToggle(account.id) : undefined)}
        aria-expanded={expandable ? expanded : undefined}
      >
        <span className={styles.raioxToggle} aria-hidden>
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>{chartAccountLabel(account)}</strong>
        <BudgetTotalsCell totals={totals} />
      </button>
      {expanded
        ? visibleGroups.map((group) => (
            <BudgetAccountBlock
              key={group.id}
              account={group}
              depth={depth + 1}
              byParent={byParent}
              planned={planned}
              actual={actual}
              drafts={drafts}
              open={open}
              matches={matches}
              pendingId={pendingId}
              busy={busy}
              onToggle={onToggle}
              onOpenYear={onOpenYear}
              onDraftChange={onDraftChange}
              onSaveLine={onSaveLine}
            />
          ))
        : null}
      {expanded
        ? visibleLeaves.map((leaf) => (
            <BudgetAccountBlock
              key={leaf.id}
              account={leaf}
              depth={depth + 1}
              byParent={byParent}
              planned={planned}
              actual={actual}
              drafts={drafts}
              open={open}
              matches={matches}
              pendingId={pendingId}
              busy={busy}
              onToggle={onToggle}
              onOpenYear={onOpenYear}
              onDraftChange={onDraftChange}
              onSaveLine={onSaveLine}
            />
          ))
        : null}
    </>
  )
}

function groupHasMatch(
  groupId: string,
  byParent: Map<string | null, ChartAccount[]>,
  matches: Set<string> | null,
): boolean {
  if (!matches) {
    return true
  }
  if (matches.has(groupId)) {
    return true
  }
  const children = byParent.get(groupId) ?? []
  return children.some((child) =>
    child.level === 'Analytical'
      ? matches.has(child.id)
      : groupHasMatch(child.id, byParent, matches),
  )
}

function BudgetYearSheet({
  year,
  account,
  months,
  line,
  loading,
  onClose,
}: {
  year: number
  account: ChartAccount
  months: string[]
  line: BudgetYear['lines'][number] | null | undefined
  loading: boolean
  onClose: () => void
}) {
  const titleId = useId()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className={styles.sheetOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.sectionHead}>
          <h2 id={titleId} className={styles.sectionTitle}>
            {chartAccountLabel(account)} · {year}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
        {loading ? <Loading /> : null}
        {!loading && months.length === 0 ? <p className={styles.muted}>Sem dados para este ano.</p> : null}
        {!loading && months.length > 0 ? (
          <ul className={styles.list}>
            {months.map((monthYm) => {
              const cell = line?.months.find((month) => month.competenceYm === monthYm)
              return (
                <li key={monthYm} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>{formatCompetence(monthYm)}</strong>
                    <span className={styles.rowSub}>
                      Planejado {cell ? formatMoney(Math.abs(cell.plannedAmount)) : '—'}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <span className={styles.rowSub}>
                      Realizado {cell ? formatMoney(Math.abs(cell.actualAmount)) : '—'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
