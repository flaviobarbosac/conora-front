import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  budgetsApi,
  categoriesApi,
  familyApi,
  monthsApi,
  projectsApi,
  type Budget,
  type BudgetYear,
  type Category,
  type LifeProject,
  type LifeProjectScope,
  type SharingScope,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { SharingViewToggle } from '../components/SharingViewToggle'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { IntegerField } from '../components/ui/IntegerField'

import { Select } from '../components/ui/Select'
import { TextArea } from '../components/ui/TextArea'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty, useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { categoryLabel } from '../lib/categoryLabel'
import { CASH_FLOW_SECTIONS, EXPENSE_SECTIONS, compareCategorySiblings } from '../lib/categoryOrder'
import {
  competencesFrom,
  currentCompetence,
  dateToApi,
  formatCompetence,
  formatMoney,
  formatMoneyInput,
  monthsInclusive,
  parseMoney,
} from '../lib/format'
import { buildAmountMaps, chartWithAmounts, groupAccountsByParent, idsWithAmount, sumBranch } from '../lib/raioX'
import { readSharingView } from '../lib/sharingView'
import styles from './page.module.css'

function safeReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return null
  }
  if (!raw.startsWith('/raio-x')) {
    return null
  }
  return raw
}

export function BudgetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusCategoryId = searchParams.get('categoryId')
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const [ym, setYm] = useState(() => searchParams.get('competenceYm') || currentCompetence())
  const [scope, setScope] = useState<SharingScope | undefined>(() => {
    const stored = readSharingView()
    return stored
  })
  const { confirmLeave, isDirty } = useUnsavedChanges()
  const budget = useLoad(() => budgetsApi.get(ym, scope), [ym, scope])
  const year = useMemo(() => Number(ym.slice(0, 4)), [ym])
  const yearData = useLoad(() => budgetsApi.getYear(year, scope), [year, scope])
  const categories = useLoad(() => categoriesApi.list(undefined, true, false), [])
  const projects = useLoad(() => projectsApi.list(), [])
  const monthStatus = useLoad(() => monthsApi.get(ym), [ym])
  const copy = useAction()
  const canEdit = budget.data?.canEdit !== false
  const monthClosed = Boolean(monthStatus.data?.isClosed)

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
            <SharingViewToggle onChange={setScope} />
            <CompetencePicker value={ym} onChange={(next) => void changeYm(next)} />
            <Button
              variant="secondary"
              disabled={copy.busy || !canEdit}
              onClick={() => void copyPrevious()}
            >
              Copiar mês anterior
            </Button>
            <Button
              variant="secondary"
              disabled={monthClosed}
              onClick={() => navigate(`/mes?competenceYm=${encodeURIComponent(ym)}`)}
            >
              Fechar mês
            </Button>
          </>
        }
      />
      <ErrorText
        message={budget.error ?? copy.error ?? categories.error ?? yearData.error ?? projects.error ?? monthStatus.error}
      />
      {data && !canEdit ? (
        <p className={styles.muted}>Somente o responsável pelo orçamento familiar pode editar o previsto.</p>
      ) : null}
      {budget.loading && !data ? <Loading /> : null}
      {data ? (
        <BudgetTreeEditor
          ym={ym}
          scope={scope}
          canEdit={canEdit}
          budget={data}
          categories={categories.data ?? []}
          categoriesLoading={categories.loading && !categories.data}
          projects={projects.data ?? []}
          year={year}
          yearData={yearData.data}
          focusCategoryId={focusCategoryId}
          onSaved={() => {
            budget.reload()
            yearData.reload()
            projects.reload()
            if (returnTo) {
              navigate(returnTo)
            }
          }}
        />
      ) : null}
    </div>
  )
}

type EditorProps = {
  ym: string
  scope: SharingScope | undefined
  canEdit: boolean
  budget: Budget
  categories: Category[]
  categoriesLoading: boolean
  projects: LifeProject[]
  year: number
  yearData: BudgetYear | null | undefined
  focusCategoryId: string | null
  onSaved: () => void
}

function BudgetTreeEditor({
  ym,
  scope,
  canEdit,
  budget,
  categories,
  categoriesLoading,
  projects,
  year,
  yearData,
  focusCategoryId,
  onSaved,
}: EditorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [dayDrafts, setDayDrafts] = useState<Record<string, string>>({})
  const [yearAccountId, setYearAccountId] = useState<string | null>(null)
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const saveAction = useAction()

  const lockedCategoryIds = useMemo(() => {
    const ids = new Set<string>()
    for (const project of projects) {
      if (project.categoryId) {
        ids.add(project.categoryId)
      }
    }
    return ids
  }, [projects])

  useEffect(() => {
    if (!focusCategoryId || categories.length === 0) {
      return
    }
    const byId = new Map(categories.map((account) => [account.id, account]))
    const target = byId.get(focusCategoryId)
    if (!target) {
      return
    }
    const ancestors = new Set<string>()
    let current: Category | undefined = target
    while (current?.parentId) {
      ancestors.add(current.parentId)
      current = byId.get(current.parentId)
    }
    if (target.level !== 'Analytical') {
      ancestors.add(target.id)
    }
    setOpen(ancestors)
    setFocusedId(focusCategoryId)
    const timer = window.setTimeout(() => {
      document.getElementById(`budget-account-${focusCategoryId}`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
      const input = document.querySelector<HTMLInputElement>(`[name="budget-${focusCategoryId}"]`)
      input?.focus()
      input?.select()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusCategoryId, categories])

  const { planned, actual } = useMemo(() => buildAmountMaps(budget.lines), [budget.lines])

  const cashAccounts = useMemo(() => {
    const cash = categories.filter((account) => CASH_FLOW_SECTIONS.includes(account.section))
    return chartWithAmounts(cash, idsWithAmount([planned, actual]))
  }, [categories, planned, actual])

  const byParent = useMemo(() => {
    const map = groupAccountsByParent(cashAccounts)
    for (const bucket of map.values()) {
      bucket.sort(compareCategorySiblings)
    }
    return map
  }, [cashAccounts])

  const roots = useMemo(
    () =>
      CASH_FLOW_SECTIONS.map((section) =>
        cashAccounts.find((account) => {
          if (account.section !== section || account.level === 'Analytical') {
            return false
          }
          const parent = categories.find((item) => item.id === account.parentId)
          return !parent || parent.section !== section
        }),
      ).filter(Boolean) as Category[],
    [cashAccounts, categories],
  )

  const expenseDays = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of budget.lines) {
      if (line.categoryId && line.expenseDay != null) {
        map.set(line.categoryId, line.expenseDay)
      }
    }
    return map
  }, [budget.lines])

  const shownPlanned = useMemo(() => {
    const map = new Map(planned)
    for (const [id, text] of Object.entries(drafts)) {
      if (!text.trim()) {
        continue
      }
      const parsed = parseMoney(text)
      if (Number.isFinite(parsed)) {
        map.set(id, parsed)
      }
    }
    return map
  }, [planned, drafts])

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

  const daySignature = useMemo(
    () =>
      [...expenseDays.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, day]) => `${id}=${day}`)
        .join('|'),
    [expenseDays],
  )

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const [id, day] of expenseDays) {
      initial[id] = String(day)
    }
    setDayDrafts(initial)
  }, [ym, daySignature])

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

  const dirtyDayIds = useMemo(() => {
    const dirty = new Set<string>()
    const ids = new Set([...Object.keys(dayDrafts), ...expenseDays.keys()])
    for (const id of ids) {
      const text = (dayDrafts[id] ?? '').trim()
      const server = expenseDays.get(id) ?? null
      const parsed = text === '' ? null : Number(text)
      if (parsed !== server) {
        dirty.add(id)
      }
    }
    return dirty
  }, [dayDrafts, expenseDays])

  useRegisterDirty('budget-tree', dirtyIds.size > 0 || dirtyDayIds.size > 0)

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? new Set(
        cashAccounts
          .filter((account) => categoryLabel(account).toLowerCase().includes(needle))
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
    const days: Record<string, string> = {}
    for (const [id, day] of expenseDays) {
      days[id] = String(day)
    }
    setDayDrafts(days)
    saveAction.setError(null)
  }

  async function saveAll() {
    const lines: { categoryId: string; plannedAmount: number; expenseDay: number | null }[] = []
    const ids = new Set([...dirtyIds, ...dirtyDayIds])
    for (const accountId of ids) {
      const text = drafts[accountId] ?? ''
      const parsed = text.trim() ? parseMoney(text) : (planned.get(accountId) ?? 0)
      if (!Number.isFinite(parsed) || parsed < 0) {
        saveAction.setError('Informe um valor válido (zero ou positivo).')
        return
      }
      const dayText = (dayDrafts[accountId] ?? '').trim()
      let expenseDay: number | null = null
      if (dayText) {
        const day = Number(dayText)
        if (!Number.isInteger(day) || day < 1 || day > 31) {
          saveAction.setError('Informe um dia entre 1 e 31.')
          return
        }
        expenseDay = day
      }
      lines.push({ categoryId: accountId, plannedAmount: parsed, expenseDay })
    }
    if (lines.length === 0) {
      return
    }
    const ok = await saveAction.run(() => budgetsApi.upsert(ym, 'Detailed', lines, scope))
    if (ok) {
      showSaveToast('Orçamento salvo.')
      onSaved()
    }
  }

  const yearAccount = yearAccountId ? cashAccounts.find((account) => account.id === yearAccountId) : null
  const yearLine = yearAccountId
    ? yearData?.lines.find((line) => line.categoryId === yearAccountId)
    : null

  return (
    <section className={styles.section}>
      <div className={styles.budgetSaveBar}>
        <p className={styles.muted}>
          {canEdit ? 'Edite o previsto e salve.' : 'Orçamento familiar em modo leitura.'}
        </p>
        <div className={styles.budgetSaveActions}>
          <Button
            type="button"
            variant="secondary"
            disabled={!canEdit || saveAction.busy || (dirtyIds.size === 0 && dirtyDayIds.size === 0)}
            onClick={cancelEdits}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!canEdit || saveAction.busy || (dirtyIds.size === 0 && dirtyDayIds.size === 0)}
            onClick={() => void saveAll()}
          >
            Salvar
          </Button>
        </div>
      </div>
      <Field
        label="Buscar categoria"
        name="budgetSearch"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ex.: aluguel, salário…"
      />
      <ErrorText message={saveAction.error} />
      {roots.length === 0 && categoriesLoading ? <Loading /> : null}
      {roots.length === 0 && !categoriesLoading ? (
        <Empty>
          {scope === 'Personal'
            ? 'Nenhuma categoria nesta visão.'
            : 'Nenhuma categoria para montar o orçamento.'}
        </Empty>
      ) : null}
      {roots.length > 0 ? (
        <div className={styles.raioxList}>
          <div className={`${styles.raioxRow} ${styles.budgetRow} ${styles.raioxHead}`}>
            <span />
            <span>Categoria</span>
            <span className={`${styles.raioxTotals} ${styles.budgetTotals} ${styles.budgetTotalsHead}`}>
              <span />
              <span>Dia</span>
            </span>
          </div>
          {roots.map((root) => (
            <BudgetAccountBlock
              key={root.id}
              account={root}
              depth={0}
              byParent={byParent}
              planned={planned}
              shownPlanned={shownPlanned}
              drafts={drafts}
              dayDrafts={dayDrafts}
              open={open}
              matches={matches}
              busy={saveAction.busy}
              canEdit={canEdit}
              lockedCategoryIds={lockedCategoryIds}
              focusedId={focusedId}
              onToggle={toggle}
              onOpenYear={(id) => {
                if (lockedCategoryIds.has(id)) {
                  return
                }
                setYearAccountId(id)
              }}
              onCreateProject={(id) => setCreateCategoryId(id)}
              onDraftChange={(id, value) => {
                if (lockedCategoryIds.has(id)) {
                  return
                }
                setDrafts((current) => ({ ...current, [id]: value }))
              }}
              onDayChange={(id, value) => {
                if (lockedCategoryIds.has(id)) {
                  return
                }
                setDayDrafts((current) => ({ ...current, [id]: value }))
              }}
            />
          ))}
        </div>
      ) : null}
      {yearAccount && !lockedCategoryIds.has(yearAccount.id) ? (
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
      {createCategoryId ? (
        <LifeProjectCreateSheet
          categoryId={createCategoryId}
          categoryName={
            cashAccounts.find((account) => account.id === createCategoryId)?.name ?? 'Projeto de vida'
          }
          onClose={() => setCreateCategoryId(null)}
          onCreated={() => {
            setCreateCategoryId(null)
            onSaved()
          }}
        />
      ) : null}
    </section>
  )
}

function BudgetTotalsCell({
  edit,
  day,
}: {
  edit?: ReactNode
  day?: ReactNode
}) {
  return (
    <span className={`${styles.raioxTotals} ${styles.budgetTotals}`}>
      {edit ?? <span />}
      {day ?? <span />}
    </span>
  )
}

const noActual = new Map<string, number>()

function BudgetAccountBlock({
  account,
  depth,
  byParent,
  planned,
  shownPlanned,
  drafts,
  dayDrafts,
  open,
  matches,
  busy,
  canEdit,
  lockedCategoryIds,
  focusedId,
  onToggle,
  onOpenYear,
  onCreateProject,
  onDraftChange,
  onDayChange,
}: {
  account: Category
  depth: number
  byParent: Map<string | null, Category[]>
  planned: Map<string, number>
  shownPlanned: Map<string, number>
  drafts: Record<string, string>
  dayDrafts: Record<string, string>
  open: Set<string>
  matches: Set<string> | null
  busy: boolean
  canEdit: boolean
  lockedCategoryIds: Set<string>
  focusedId: string | null
  onToggle: (id: string) => void
  onOpenYear: (id: string) => void
  onCreateProject: (id: string) => void
  onDraftChange: (id: string, value: string) => void
  onDayChange: (id: string, value: string) => void
}) {
  const children = byParent.get(account.id) ?? []
  const groups = children.filter((child) => child.level === 'Group')
  const leaves = children.filter((child) => child.level === 'Analytical')
  const expandable = groups.length > 0 || leaves.length > 0
  const expanded = open.has(account.id) || Boolean(matches)
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
    const locked = lockedCategoryIds.has(account.id)
    const needsProject = account.section === 'LifeProject' && !locked
    const draft = drafts[account.id] ?? formatMoneyInput(planned.get(account.id) ?? 0)
    const isFocused = focusedId === account.id
    return (
      <div
        id={`budget-account-${account.id}`}
        className={`${styles.raioxRow} ${styles.budgetRow} ${rowClass}${isFocused ? ` ${styles.budgetRowFocus}` : ''}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
      >
        <span />
        <span className={styles.budgetAccountCell}>
          <strong className={styles.raioxAccountName}>
            {categoryLabel(account)}
            {!account.isActive ? <span className={styles.rowSub}> · Inativa</span> : null}
          </strong>
          {needsProject && canEdit ? (
            <button
              type="button"
              className={styles.budgetAccountLink}
              onClick={() => onCreateProject(account.id)}
            >
              Criar projeto de vida
            </button>
          ) : null}
          {locked ? <span className={styles.muted}>Rateio do projeto</span> : null}
        </span>
        <BudgetTotalsCell
          edit={
            <span className={styles.budgetPlannedCell}>
              <span className={styles.raioxBudgetField}>
                <MoneyField
                  compact
                  label={`Orçamento ${categoryLabel(account)}`}
                  name={`budget-${account.id}`}
                  value={locked ? formatMoneyInput(planned.get(account.id) ?? 0) : draft}
                  disabled={busy || !canEdit || locked || needsProject}
                  onChange={(value) => onDraftChange(account.id, value)}
                />
              </span>
              <button
                type="button"
                className={styles.budgetSpreadIcon}
                disabled={busy || !canEdit || locked || needsProject}
                aria-label={`Repetir ou parcelar ${categoryLabel(account)}`}
                title="Repetir ou parcelar"
                onClick={() => onOpenYear(account.id)}
              >
                <Icon name="repeat" size={20} />
              </button>
            </span>
          }
          day={
            EXPENSE_SECTIONS.includes(account.section) ? (
              <span className={styles.budgetDayField}>
                <IntegerField
                  compact
                  label={`Dia de vencimento ${categoryLabel(account)}`}
                  name={`budget-day-${account.id}`}
                  placeholder="Dia"
                  maxLength={2}
                  value={dayDrafts[account.id] ?? ''}
                  disabled={busy || !canEdit || locked || needsProject}
                  onChange={(value) => onDayChange(account.id, value)}
                />
              </span>
            ) : (
              <span className={styles.budgetDayField} aria-hidden="true" />
            )
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
        <strong className={styles.raioxAccountName}>
          {categoryLabel(account)}
          {!account.isActive ? <span className={styles.rowSub}> · Inativa</span> : null}
        </strong>
        <BudgetTotalsCell
          edit={
            <span className={styles.budgetPlannedCell}>
              <strong className={styles.moneyValue}>
                {formatMoney(sumBranch(account.id, byParent, shownPlanned, noActual).planned)}
              </strong>
            </span>
          }
        />
      </button>
      {expanded
        ? visibleGroups.map((group) => (
            <BudgetAccountBlock
              key={group.id}
              account={group}
              depth={depth + 1}
              byParent={byParent}
              planned={planned}
              shownPlanned={shownPlanned}
              drafts={drafts}
              dayDrafts={dayDrafts}
              open={open}
              matches={matches}
              busy={busy}
              canEdit={canEdit}
              lockedCategoryIds={lockedCategoryIds}
              focusedId={focusedId}
              onToggle={onToggle}
              onOpenYear={onOpenYear}
              onCreateProject={onCreateProject}
              onDraftChange={onDraftChange}
              onDayChange={onDayChange}
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
              shownPlanned={shownPlanned}
              drafts={drafts}
              dayDrafts={dayDrafts}
              open={open}
              matches={matches}
              busy={busy}
              canEdit={canEdit}
              lockedCategoryIds={lockedCategoryIds}
              focusedId={focusedId}
              onToggle={onToggle}
              onOpenYear={onOpenYear}
              onCreateProject={onCreateProject}
              onDraftChange={onDraftChange}
              onDayChange={onDayChange}
            />
          ))
        : null}
    </>
  )
}

function groupHasMatch(
  groupId: string,
  byParent: Map<string | null, Category[]>,
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
  account: Category
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
            {categoryLabel(account)} · {year}
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

function LifeProjectCreateSheet({
  categoryId,
  categoryName,
  onClose,
  onCreated,
}: {
  categoryId: string
  categoryName: string
  onClose: () => void
  onCreated: () => void
}) {
  const titleId = useId()
  const family = useLoad(() => familyApi.group(), [])
  const action = useAction()
  const [name, setName] = useState(categoryName)
  const [detailedDescription, setDetailedDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [dueYm, setDueYm] = useState('')
  const [startYm, setStartYm] = useState(() => currentCompetence())
  const [scope, setScope] = useState<LifeProjectScope>('Personal')
  const hasFamilyGroup = Boolean(family.data?.groupId)
  const currentYm = currentCompetence()
  const months = dueYm ? monthsInclusive(startYm, dueYm) : []
  const goalAmount = parseMoney(goal)
  const parcel =
    months.length > 0 && Number.isFinite(goalAmount) && goalAmount > 0 ? goalAmount / months.length : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
      action.setError('Informe uma meta maior que zero.')
      return
    }
    if (!dueYm) {
      action.setError('Informe o prazo.')
      return
    }
    if (startYm < currentYm) {
      action.setError('O início do aporte não pode ser antes do mês atual.')
      return
    }
    if (startYm > dueYm) {
      action.setError('O início do aporte não pode ser depois do prazo.')
      return
    }
    const projectScope = scope === 'Group' && hasFamilyGroup ? 'Group' : 'Personal'
    if (
      await action.run(() =>
        projectsApi.create({
          name: name.trim() || categoryName,
          goalAmount,
          dueDate: dateToApi(`${dueYm}-01`),
          contributionStartYm: startYm,
          scope: projectScope,
          categoryId,
          detailedDescription: detailedDescription.trim() || undefined,
        }),
      )
    ) {
      showSaveToast('Projeto criado e rateado no orçamento.')
      onCreated()
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
            Novo projeto · {categoryName}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.formWide}>
            <Field label="Nome" name="budgetProjectName" required value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className={styles.formWide}>
            <TextArea
              label="Descrição detalhada"
              name="budgetProjectDescription"
              rows={3}
              value={detailedDescription}
              onChange={(event) => setDetailedDescription(event.target.value)}
              maxLength={4000}
            />
          </div>
          <Select
            label="Escopo"
            name="budgetProjectScope"
            value={scope}
            onChange={(event) => setScope(event.target.value as LifeProjectScope)}
          >
            <option value="Personal">Pessoal</option>
            <option value="Group" disabled={!hasFamilyGroup}>
              Família{hasFamilyGroup ? '' : ' — entre no grupo primeiro'}
            </option>
          </Select>
          <MoneyField label="Meta (R$)" name="budgetProjectGoal" required value={goal} onChange={setGoal} />
          <Field
            label="Prazo"
            name="budgetProjectDue"
            type="month"
            required
            value={dueYm}
            min={startYm || currentYm}
            onChange={(event) => setDueYm(event.target.value)}
          />
          <Field
            label="Início do aporte"
            name="budgetProjectStart"
            type="month"
            required
            value={startYm}
            min={currentYm}
            max={dueYm || undefined}
            onChange={(event) => setStartYm(event.target.value)}
          />
          {parcel !== null ? (
            <p className={`${styles.muted} ${styles.formWide}`}>
              Rateio automático: {formatMoney(parcel)}/mês · {months.length}{' '}
              {months.length === 1 ? 'mês' : 'meses'}
            </p>
          ) : null}
          <div className={styles.formWide}>
            <ErrorText message={action.error} />
          </div>
          <div className={styles.formActions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={action.busy}>
              Salvar projeto
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
