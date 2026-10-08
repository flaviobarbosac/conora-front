import { useEffect, useId, useMemo, useState } from 'react'
import {
  budgetsApi,
  chartAccountsApi,
  type Budget,
  type BudgetYear,
  type ChartAccount,
  type ChartSection,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty, useUnsavedChanges } from '../hooks/useUnsavedChanges'
import {
  currentCompetence,
  formatCompetence,
  formatMoney,
  formatMoneyInput,
  parseMoney,
} from '../lib/format'
import { chartAccountLabel } from '../lib/chartLabel'
import { compareChartSiblings } from '../lib/chartOrder'
import styles from './page.module.css'

const EXPENSE_SECTIONS: ChartSection[] = ['Discount', 'LifeProject', 'Essential', 'Social']

const SECTION_HINT: Partial<Record<ChartSection, string>> = {
  Discount: 'o que reduz a renda',
  LifeProject: 'o que você separa para o futuro',
  Essential: 'o que a casa precisa',
  Social: 'o que é escolha',
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
        <BudgetEditor
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

function BudgetEditor({ ym, budget, categories, year, yearData, yearLoading, onSaved }: EditorProps) {
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EXPENSE_SECTIONS.map((section) => [section, false])),
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [yearAccountId, setYearAccountId] = useState<string | null>(null)
  const action = useAction()

  const plannedById = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of budget.lines) {
      if (line.chartAccountId && !line.isGroup) {
        map.set(line.chartAccountId, line.plannedAmount)
      }
    }
    return map
  }, [budget.lines])

  const actualById = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of budget.lines) {
      if (line.chartAccountId && !line.isGroup) {
        map.set(line.chartAccountId, line.actualAmount)
      }
    }
    return map
  }, [budget.lines])

  const plannedSignature = useMemo(
    () =>
      [...plannedById.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, amount]) => `${id}=${amount}`)
        .join('|'),
    [plannedById],
  )

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const part of plannedSignature.split('|')) {
      if (!part) {
        continue
      }
      const [id, amountText] = part.split('=')
      if (id) {
        initial[id] = formatMoneyInput(Number(amountText))
      }
    }
    setDrafts(initial)
    action.setError(null)
  }, [ym, plannedSignature])

  const expenseAccounts = useMemo(
    () => categories.filter((account) => EXPENSE_SECTIONS.includes(account.section) && account.isActive),
    [categories],
  )

  const byParent = useMemo(() => {
    const map = new Map<string | null, ChartAccount[]>()
    for (const account of expenseAccounts) {
      const key = account.parentId
      const bucket = map.get(key) ?? []
      bucket.push(account)
      map.set(key, bucket)
    }
    for (const bucket of map.values()) {
      bucket.sort(compareChartSiblings)
    }
    return map
  }, [expenseAccounts])

  const roots = EXPENSE_SECTIONS.map((section) =>
    expenseAccounts.find((account) => account.level === 'Root' && account.section === section),
  ).filter(Boolean) as ChartAccount[]

  const editableIds = useMemo(
    () => new Set(expenseAccounts.filter((account) => account.level === 'Analytical').map((account) => account.id)),
    [expenseAccounts],
  )

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? new Set(
        expenseAccounts
          .filter((account) => chartAccountLabel(account).toLowerCase().includes(needle))
          .map((account) => account.id),
      )
    : null

  function hasVisibleAnalytical(id: string): boolean {
    const children = byParent.get(id) ?? []
    return children.some((child) => {
      if (child.level === 'Analytical') {
        return editableIds.has(child.id) && (!matches || matches.has(child.id))
      }
      return hasVisibleAnalytical(child.id)
    })
  }

  function collectAnalyticalIds(parentId: string): string[] {
    const children = byParent.get(parentId) ?? []
    const ids: string[] = []
    for (const child of children) {
      if (child.level === 'Analytical') {
        if (editableIds.has(child.id)) {
          ids.push(child.id)
        }
      } else {
        ids.push(...collectAnalyticalIds(child.id))
      }
    }
    return ids
  }

  function sumPlanned(accountIds: string[]): number {
    return accountIds.reduce((total, id) => {
      const text = drafts[id]
      if (text !== undefined && text.trim()) {
        const parsed = parseMoney(text)
        return total + (Number.isFinite(parsed) ? parsed : 0)
      }
      return total + (plannedById.get(id) ?? 0)
    }, 0)
  }

  function sumActual(accountIds: string[]): number {
    return accountIds.reduce((total, id) => total + (actualById.get(id) ?? 0), 0)
  }

  const isDirty = useMemo(() => {
    const ids = new Set<string>([...plannedById.keys(), ...Object.keys(drafts)])
    for (const id of ids) {
      const planned = plannedById.get(id)
      const trimmed = (drafts[id] ?? '').trim()
      if (!trimmed) {
        if (planned !== undefined) {
          return true
        }
        continue
      }
      const parsed = parseMoney(trimmed)
      if (!Number.isFinite(parsed)) {
        return true
      }
      if ((planned ?? 0) !== parsed) {
        return true
      }
    }
    return false
  }, [drafts, plannedById])

  useRegisterDirty(`budget:${ym}`, isDirty)

  function isGroupOpen(groupId: string): boolean {
    if (matches) {
      return collectAnalyticalIds(groupId).some((id) => matches.has(id))
    }
    return openGroups[groupId] ?? false
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => ({ ...current, [groupId]: !(current[groupId] ?? false) }))
  }

  function resetDraftsFromServer() {
    const initial: Record<string, string> = {}
    for (const [id, amount] of plannedById) {
      initial[id] = formatMoneyInput(amount)
    }
    setDrafts(initial)
    action.setError(null)
  }

  async function save() {
    const lines: { chartAccountId: string; plannedAmount: number }[] = []
    const toRemove: string[] = []
    const ids = new Set<string>([...plannedById.keys(), ...Object.keys(drafts)])

    for (const id of ids) {
      const previous = plannedById.get(id)
      const text = (drafts[id] ?? '').trim()
      if (!text) {
        if (previous !== undefined) {
          toRemove.push(id)
        }
        continue
      }
      const plannedAmount = parseMoney(text)
      if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
        action.setError('Há um valor inválido no orçamento.')
        return
      }
      if (previous !== plannedAmount) {
        lines.push({ chartAccountId: id, plannedAmount })
      }
    }

    if (lines.length === 0 && toRemove.length === 0) {
      return
    }

    if (
      await action.run(async () => {
        if (lines.length > 0) {
          await budgetsApi.upsert(ym, 'Detailed', lines)
        }
        for (const id of toRemove) {
          await budgetsApi.removeLine(ym, id)
        }
      })
    ) {
      onSaved()
    }
  }

  function renderAnalytical(account: ChartAccount) {
    if (!editableIds.has(account.id)) {
      return null
    }
    if (matches && !matches.has(account.id)) {
      return null
    }
    const actual = actualById.get(account.id) ?? 0
    return (
      <li key={account.id} className={styles.row}>
        <span className={styles.rowMain}>
          <button
            type="button"
            className={styles.budgetAccountName}
            onClick={() => setYearAccountId(account.id)}
          >
            <strong>{chartAccountLabel(account)}</strong>
          </button>
          <span className={styles.rowSub}>Realizado {formatMoney(actual)}</span>
        </span>
        <span className={styles.rowEnd}>
          <span className={styles.budgetAmountWrap}>
            <MoneyField
              compact
              label={`Orçamento ${chartAccountLabel(account)}`}
              name={`budget-${account.id}`}
              value={drafts[account.id] ?? ''}
              disabled={action.busy}
              onChange={(value) => setDrafts((current) => ({ ...current, [account.id]: value }))}
            />
          </span>
        </span>
      </li>
    )
  }

  function groupHasVisibleContent(groupId: string): boolean {
    return hasVisibleAnalytical(groupId)
  }

  function renderGroup(group: ChartAccount, depth = 1) {
    if (!groupHasVisibleContent(group.id)) {
      return null
    }
    const analyticalIds = collectAnalyticalIds(group.id)
    const planned = sumPlanned(analyticalIds)
    const actual = sumActual(analyticalIds)
    const open = isGroupOpen(group.id)
    const children = byParent.get(group.id) ?? []
    const nestedGroups = children.filter((child) => child.level === 'Group')
    const leaves = children.filter(
      (child) => child.level === 'Analytical' && editableIds.has(child.id) && (!matches || matches.has(child.id)),
    )

    return (
      <div key={group.id} className={styles.budgetGroup} style={{ marginLeft: depth > 1 ? 12 : 0 }}>
        <button
          type="button"
          className={styles.budgetGroupToggle}
          aria-expanded={open}
          onClick={() => toggleGroup(group.id)}
        >
          <span className={styles.budgetGroupChevron} aria-hidden>
            {open ? '−' : '+'}
          </span>
          <span className={styles.budgetGroupMain}>
            <strong>{chartAccountLabel(group)}</strong>
            <span className={styles.muted}>
              Planejado {formatMoney(planned)} · Realizado {formatMoney(actual)}
            </span>
          </span>
        </button>
        {open ? (
          <div className={styles.budgetGroupBody}>
            {nestedGroups.map((nested) => renderGroup(nested, depth + 1))}
            {leaves.length > 0 ? <ul className={styles.list}>{leaves.map((leaf) => renderAnalytical(leaf))}</ul> : null}
          </div>
        ) : null}
      </div>
    )
  }

  function renderChildren(parent: ChartAccount) {
    const children = byParent.get(parent.id) ?? []
    const groups = children.filter((child) => child.level === 'Group')
    const leaves = children.filter((child) => child.level === 'Analytical')

    return (
      <>
        {groups.map((group) => renderGroup(group))}
        {leaves.length > 0 ? <ul className={styles.list}>{leaves.map((leaf) => renderAnalytical(leaf))}</ul> : null}
      </>
    )
  }

  const yearAccount = yearAccountId ? expenseAccounts.find((account) => account.id === yearAccountId) : null
  const yearLine = yearAccountId
    ? yearData?.lines.find((line) => line.chartAccountId === yearAccountId)
    : null
  const visibleRoots = roots.filter((root) => hasVisibleAnalytical(root.id))

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Definir orçamento</h2>
      </div>
      <p className={styles.muted}>
        Informe o valor planejado em cada conta e use Salvar. Toque no nome da conta para ver o ano. O realizado vem
        dos lançamentos.
      </p>
      <Field
        label="Buscar"
        name="budgetSearch"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ex.: aluguel, mercado…"
      />
      <ErrorText message={action.error} />
      {visibleRoots.length === 0 ? <Empty>Nenhuma conta de despesa.</Empty> : null}
      {visibleRoots.map((root) => {
        const open = Boolean(matches) || (openSections[root.section] ?? false)
        const analyticalIds = collectAnalyticalIds(root.id)
        const planned = sumPlanned(analyticalIds)
        const actual = sumActual(analyticalIds)
        return (
          <section key={root.id} className={styles.section}>
            <button
              type="button"
              className={styles.sectionTitle}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onClick={() =>
                setOpenSections((current) => ({ ...current, [root.section]: !(current[root.section] ?? false) }))
              }
            >
              <span>
                {chartAccountLabel(root)} — {SECTION_HINT[root.section]}
              </span>
            </button>
            <p className={styles.muted}>
              Planejado {formatMoney(planned)} · Realizado {formatMoney(actual)}
            </p>
            {open ? renderChildren(root) : null}
          </section>
        )
      })}

      {yearAccountId && yearAccount ? (
        <BudgetYearSheet
          year={year}
          account={yearAccount}
          months={yearData?.months ?? []}
          line={yearLine}
          loading={yearLoading && !yearData}
          onClose={() => setYearAccountId(null)}
        />
      ) : null}

      <div className={styles.actions}>
        <Button disabled={action.busy || !isDirty} onClick={() => void save()}>
          Salvar
        </Button>
        <Button variant="secondary" disabled={action.busy || !isDirty} onClick={resetDraftsFromServer}>
          Cancelar
        </Button>
      </div>
    </section>
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
                      Planejado {cell ? formatMoney(cell.plannedAmount) : '—'}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <span className={styles.rowSub}>
                      Realizado {cell ? formatMoney(cell.actualAmount) : '—'}
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
