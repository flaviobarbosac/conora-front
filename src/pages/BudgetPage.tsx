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
import { Icon } from '../components/ui/Icon'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { IntegerField } from '../components/ui/IntegerField'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty, useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { chartAccountLabel } from '../lib/chartLabel'
import { CASH_FLOW_SECTIONS, compareChartSiblings } from '../lib/chartOrder'
import {
  competencesFrom,
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
  if (tone === 'unbudgeted') {
    return styles.raioxToneUnbudgeted
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
    const hasPlanned = (budget.data?.lines ?? []).some(
      (line) => !line.isGroup && Math.abs(line.plannedAmount) > 0.001,
    )
    let overwrite = false
    if (hasPlanned) {
      overwrite = await confirmDestructive(
        'Este mês já tem valores previstos. Deseja sobrescrever com o mês anterior?',
        {
          title: 'Copiar mês anterior',
          confirmLabel: 'Sobrescrever',
          cancelLabel: 'Só contas vazias',
          danger: false,
        },
      )
      // cancelLabel path: confirmDestructive returns false → copy without overwrite
    }
    if (await copy.run(() => budgetsApi.copyPrevious(ym, overwrite))) {
      showSaveToast(
        overwrite ? 'Orçamento copiado do mês anterior.' : 'Contas vazias preenchidas com o mês anterior.',
      )
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
  onSaved: () => void
}

function BudgetTreeEditor({ ym, budget, categories, year, yearData, onSaved }: EditorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
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

  function cancelEdits() {
    const initial: Record<string, string> = {}
    for (const [id, amount] of planned.entries()) {
      initial[id] = formatMoneyInput(amount)
    }
    setDrafts(initial)
    saveAction.setError(null)
  }

  async function saveAll() {
    const lines: { chartAccountId: string; plannedAmount: number }[] = []
    for (const accountId of dirtyIds) {
      const text = drafts[accountId] ?? ''
      const parsed = text.trim() ? parseMoney(text) : 0
      if (!Number.isFinite(parsed) || parsed < 0) {
        saveAction.setError('Informe um valor válido (zero ou positivo).')
        return
      }
      lines.push({ chartAccountId: accountId, plannedAmount: parsed })
    }
    if (lines.length === 0) {
      return
    }
    const ok = await saveAction.run(() => budgetsApi.upsert(ym, 'Detailed', lines))
    if (ok) {
      showSaveToast('Orçamento salvo.')
      onSaved()
    }
  }

  const yearAccount = yearAccountId ? cashAccounts.find((account) => account.id === yearAccountId) : null
  const yearLine = yearAccountId
    ? yearData?.lines.find((line) => line.chartAccountId === yearAccountId)
    : null

  return (
    <section className={styles.section}>
      <div className={styles.budgetSaveBar}>
        <p className={styles.muted}>Edite o previsto e salve.</p>
        <div className={styles.budgetSaveActions}>
          <Button
            type="button"
            variant="secondary"
            disabled={saveAction.busy || dirtyIds.size === 0}
            onClick={cancelEdits}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={saveAction.busy || dirtyIds.size === 0} onClick={() => void saveAll()}>
            Salvar
          </Button>
        </div>
      </div>
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
          <p className={styles.raioxLegend}>
            <span className={styles.raioxLegendMark}>Amarelo</span> = sem orçamento lançado.
          </p>
          <div className={`${styles.raioxRow} ${styles.budgetRow} ${styles.raioxHead}`}>
            <span />
            <span>Conta</span>
            <span className={`${styles.raioxTotals} ${styles.budgetTotals} ${styles.budgetTotalsHead}`}>
              <span>Previsto</span>
              <span>Realizado</span>
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
              busy={saveAction.busy}
              onToggle={toggle}
              onOpenYear={setYearAccountId}
              onDraftChange={(id, value) => setDrafts((current) => ({ ...current, [id]: value }))}
            />
          ))}
        </div>
      ) : null}
      {yearAccount ? (
        <BudgetYearSheet
          ym={ym}
          year={year}
          account={yearAccount}
          line={yearLine}
          plannedAmount={(() => {
            const draft = drafts[yearAccount.id]
            if (draft != null && draft.trim()) {
              const parsed = parseMoney(draft)
              if (Number.isFinite(parsed) && parsed >= 0) {
                return parsed
              }
            }
            return planned.get(yearAccount.id) ?? 0
          })()}
          onClose={() => setYearAccountId(null)}
          onChanged={() => {
            onSaved()
          }}
        />
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
  const shown = percent === null ? 0 : percent
  return (
    <span className={`${styles.raioxTotals} ${styles.budgetTotals}`}>
      {edit ?? (
        <span className={`${styles.raioxAmount} ${styles.moneyValue} ${styles.budgetAmountAlign}`}>
          {formatMoney(totals.planned)}
        </span>
      )}
      <span className={`${styles.raioxAmount} ${styles.moneyValue}`}>{formatMoney(totals.actual)}</span>
      <span className={`${styles.raioxPercent} ${toneClass(tone)}`}>{formatPercent(shown)}</span>
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
  busy,
  onToggle,
  onOpenYear,
  onDraftChange,
}: {
  account: ChartAccount
  depth: number
  byParent: Map<string | null, ChartAccount[]>
  planned: Map<string, number>
  actual: Map<string, number>
  drafts: Record<string, string>
  open: Set<string>
  matches: Set<string> | null
  busy: boolean
  onToggle: (id: string) => void
  onOpenYear: (id: string) => void
  onDraftChange: (id: string, value: string) => void
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
        className={`${styles.raioxRow} ${styles.budgetRow} ${rowClass}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
      >
        <span />
        <span className={styles.budgetAccountCell}>
          <strong className={styles.raioxAccountName}>{chartAccountLabel(account)}</strong>
        </span>
        <BudgetTotalsCell
          totals={{ planned: lineTotals.planned, actual: lineTotals.actual }}
          edit={
            <span className={styles.budgetPlannedCell}>
              <span className={styles.raioxBudgetField}>
                <MoneyField
                  compact
                  label={`Orçamento ${chartAccountLabel(account)}`}
                  name={`budget-${account.id}`}
                  value={draft}
                  disabled={busy}
                  onChange={(value) => onDraftChange(account.id, value)}
                />
              </span>
              <button
                type="button"
                className={styles.budgetSpreadIcon}
                disabled={busy}
                aria-label={`Repetir ou parcelar ${chartAccountLabel(account)}`}
                title="Repetir ou parcelar"
                onClick={() => onOpenYear(account.id)}
              >
                <Icon name="repeat" size={20} />
              </button>
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
        className={`${styles.raioxRow} ${styles.budgetRow} ${rowClass}`}
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
              busy={busy}
              onToggle={onToggle}
              onOpenYear={onOpenYear}
              onDraftChange={onDraftChange}
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
              busy={busy}
              onToggle={onToggle}
              onOpenYear={onOpenYear}
              onDraftChange={onDraftChange}
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

type AppliedMonth = { ym: string; amount: number }

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function plannedOn(line: BudgetYear['lines'][number] | null | undefined, monthYm: string): number {
  return Math.abs(line?.months.find((month) => month.competenceYm === monthYm)?.plannedAmount ?? 0)
}

function monthsAfterAction(
  startYm: string,
  count: number,
  values: number[],
  line: BudgetYear['lines'][number] | null | undefined,
  overwrite: boolean,
  skipStart: boolean,
): AppliedMonth[] {
  return competencesFrom(startYm, count)
    .slice(skipStart ? 1 : 0)
    .map((monthYm, index) => {
      const existing = plannedOn(line, monthYm)
      const next = values[index] ?? 0
      const kept = !overwrite && existing > 0.001
      return { ym: monthYm, amount: kept ? existing : next }
    })
}

function AppliedMonths({ months }: { months: AppliedMonth[] | null }) {
  if (!months || months.length === 0) {
    return null
  }
  return (
    <ul className={styles.budgetResult} aria-label="Meses atualizados">
      {months.map((month) => (
        <li key={month.ym}>
          <span>{formatCompetence(month.ym)}</span>
          <span className={styles.moneyValue}>{formatMoney(month.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

function BudgetYearSheet({
  ym,
  year,
  account,
  line,
  plannedAmount,
  onClose,
  onChanged,
}: {
  ym: string
  year: number
  account: ChartAccount
  line: BudgetYear['lines'][number] | null | undefined
  plannedAmount: number
  onClose: () => void
  onChanged: () => void
}) {
  const titleId = useId()
  const action = useAction()
  const [repeatMonths, setRepeatMonths] = useState('3')
  const [installmentCount, setInstallmentCount] = useState('3')
  const [installmentTotal, setInstallmentTotal] = useState(() => formatMoneyInput(plannedAmount))
  const [applied, setApplied] = useState<AppliedMonth[] | null>(null)
  const [appliedKind, setAppliedKind] = useState<'repeat' | 'installment' | null>(null)

  useEffect(() => {
    setInstallmentTotal(formatMoneyInput(plannedAmount))
  }, [plannedAmount, account.id])

  useEffect(() => {
    setApplied(null)
    setAppliedKind(null)
  }, [account.id])

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

  function hasConflict(fromYm: string, count: number, skipStart: boolean): boolean {
    const targets = competencesFrom(fromYm, count).slice(skipStart ? 1 : 0)
    return targets.some((monthYm) => {
      if (monthYm === ym && skipStart) {
        return false
      }
      const cell = line?.months.find((month) => month.competenceYm === monthYm)
      return Math.abs(cell?.plannedAmount ?? 0) > 0.001
    })
  }

  async function resolveOverwrite(needsAsk: boolean): Promise<boolean> {
    if (!needsAsk) {
      return false
    }
    return confirmDestructive('Alguns meses já têm previsto. Deseja sobrescrever?', {
      title: 'Meses com previsto',
      confirmLabel: 'Sobrescrever',
      cancelLabel: 'Só vazios',
      danger: false,
    })
  }

  async function runRepeat() {
    const count = Number(repeatMonths)
    if (!Number.isFinite(count) || count < 2) {
      action.setError('Informe quantos meses (mínimo 2).')
      return
    }
    if (plannedAmount <= 0) {
      action.setError('Informe um previsto neste mês antes de repetir.')
      return
    }
    const overwrite = await resolveOverwrite(hasConflict(ym, count, true))
    if (
      await action.run(() => budgetsApi.repeat(ym, account.id, count, overwrite, plannedAmount))
    ) {
      setAppliedKind('repeat')
      setApplied(monthsAfterAction(ym, count, Array(count).fill(plannedAmount), line, overwrite, true))
      showSaveToast('Previsto repetido nos meses seguintes.')
      onChanged()
    }
  }

  async function runInstallments() {
    const count = Number(installmentCount)
    const total = parseMoney(installmentTotal)
    if (!Number.isFinite(count) || count < 2) {
      action.setError('Informe a quantidade de parcelas (mínimo 2).')
      return
    }
    if (!Number.isFinite(total) || total <= 0) {
      action.setError('Informe o valor total a parcelar.')
      return
    }
    const overwrite = await resolveOverwrite(hasConflict(ym, count, false))
    const each = roundMoney(total / count)
    const shares: number[] = []
    let allocated = 0
    for (let i = 0; i < count; i++) {
      const value = i === count - 1 ? roundMoney(total - allocated) : each
      shares.push(value)
      allocated = roundMoney(allocated + value)
    }
    if (await action.run(() => budgetsApi.installments(ym, account.id, total, count, overwrite))) {
      setAppliedKind('installment')
      setApplied(monthsAfterAction(ym, count, shares, line, overwrite, false))
      showSaveToast('Parcelas gravadas no orçamento.')
      onChanged()
    }
  }

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
      <div className={`${styles.sheet} ${styles.budgetSheet}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.sectionHead}>
          <h2 id={titleId} className={styles.sectionTitle}>
            {chartAccountLabel(account)} · {year}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
        <div className={styles.budgetSpread}>
          <div className={styles.budgetSpreadBlock}>
            <div>
              <h3 className={styles.budgetSpreadTitle}>Repetir o previsto</h3>
              <p className={styles.muted}>Copia o valor deste mês para os meses seguintes.</p>
            </div>
            <IntegerField
              label="Quantos meses?"
              name="budgetRepeat"
              maxLength={3}
              value={repeatMonths}
              onChange={setRepeatMonths}
            />
            <Button type="button" variant="secondary" disabled={action.busy} onClick={() => void runRepeat()}>
              Repetir
            </Button>
            {appliedKind === 'repeat' ? <AppliedMonths months={applied} /> : null}
          </div>
          <div className={styles.budgetSpreadBlock}>
            <div>
              <h3 className={styles.budgetSpreadTitle}>Parcelar um total</h3>
              <p className={styles.muted}>Divide o valor a partir deste mês.</p>
            </div>
            <MoneyField
              label="Valor total"
              name="budgetInstallmentTotal"
              value={installmentTotal}
              onChange={setInstallmentTotal}
            />
            <IntegerField
              label="Quantidade de parcelas"
              name="budgetInstallments"
              maxLength={3}
              value={installmentCount}
              onChange={setInstallmentCount}
            />
            <Button type="button" variant="secondary" disabled={action.busy} onClick={() => void runInstallments()}>
              Parcelar
            </Button>
            {appliedKind === 'installment' ? <AppliedMonths months={applied} /> : null}
          </div>
        </div>
        <ErrorText message={action.error} />
      </div>
    </div>
  )
}
