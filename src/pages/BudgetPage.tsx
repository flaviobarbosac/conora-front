import { useEffect, useId, useMemo, useState } from 'react'
import {
  budgetsApi,
  chartAccountsApi,
  type Budget,
  type BudgetMode,
  type BudgetYear,
  type ChartAccount,
  type ChartSection,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import {
  currentCompetence,
  formatCompetence,
  formatMoney,
  formatMoneyInput,
  parseMoney,
} from '../lib/format'
import { chartAccountLabel } from '../lib/chartLabel'
import { readDefaultBudgetMode } from '../lib/preferences'
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
  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const year = useMemo(() => Number(ym.slice(0, 4)), [ym])
  const yearData = useLoad(() => budgetsApi.getYear(year), [year])
  const categories = useLoad(() => chartAccountsApi.list(undefined, false, false), [])
  const copy = useAction()

  async function copyPrevious() {
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
            <CompetencePicker value={ym} onChange={setYm} />
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
  const [mode, setMode] = useState<BudgetMode>(() =>
    budget.lines.some((line) => !line.isGroup && line.plannedAmount > 0) ? budget.mode : readDefaultBudgetMode(),
  )
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EXPENSE_SECTIONS.map((section) => [section, false])),
  )
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
      bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
    }
    return map
  }, [expenseAccounts])

  const roots = EXPENSE_SECTIONS.map((section) =>
    expenseAccounts.find((account) => account.level === 'Root' && account.section === section),
  ).filter(Boolean) as ChartAccount[]

  const editableIds = useMemo(() => {
    const analytical = expenseAccounts.filter((account) => account.level === 'Analytical')
    if (mode === 'Detailed') {
      return new Set(analytical.map((account) => account.id))
    }
    return new Set(analytical.filter((account) => plannedById.has(account.id)).map((account) => account.id))
  }, [expenseAccounts, mode, plannedById])

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

  async function commitAccount(accountId: string) {
    const text = (drafts[accountId] ?? '').trim()
    const previous = plannedById.get(accountId)

    if (!text) {
      if (previous === undefined) {
        return
      }
      if (await action.run(() => budgetsApi.removeLine(ym, accountId))) {
        onSaved()
      }
      return
    }

    const plannedAmount = parseMoney(text)
    if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
      action.setError('Há um valor inválido no orçamento.')
      return
    }
    if (previous === plannedAmount) {
      return
    }

    if (await action.run(() => budgetsApi.upsert(ym, mode, [{ chartAccountId: accountId, plannedAmount }]))) {
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
              onCommit={() => void commitAccount(account.id)}
            />
          </span>
        </span>
      </li>
    )
  }

  function renderChildren(parent: ChartAccount) {
    const children = byParent.get(parent.id) ?? []
    const groups = children.filter((child) => child.level === 'Group')
    const leaves = children.filter((child) => child.level === 'Analytical')

    return (
      <>
        {groups.map((group) => {
          const analyticalIds = collectAnalyticalIds(group.id)
          const visibleLeaves = (byParent.get(group.id) ?? []).filter(
            (leaf) => editableIds.has(leaf.id) && (!matches || matches.has(leaf.id)),
          )
          if (visibleLeaves.length === 0) {
            return null
          }
          const planned = sumPlanned(analyticalIds)
          const actual = sumActual(analyticalIds)
          return (
            <div key={group.id} className={styles.section} style={{ marginLeft: 12 }}>
              <h3 className={styles.sectionTitle}>
                {chartAccountLabel(group)} <Badge>Soma</Badge>
              </h3>
              <p className={styles.muted}>
                Planejado {formatMoney(planned)} · Realizado {formatMoney(actual)}
              </p>
              <ul className={styles.list}>{visibleLeaves.map((leaf) => renderAnalytical(leaf))}</ul>
            </div>
          )
        })}
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
        <div className={styles.segmented} role="group" aria-label="Modo do orçamento">
          <button type="button" aria-pressed={mode === 'Simple'} onClick={() => setMode('Simple')}>
            Simples
          </button>
          <button type="button" aria-pressed={mode === 'Detailed'} onClick={() => setMode('Detailed')}>
            Detalhado
          </button>
        </div>
      </div>
      <p className={styles.muted}>
        Informe o valor planejado em cada conta. Toque no nome da conta para ver o ano. O realizado vem dos
        lançamentos.
      </p>
      <Field
        label="Buscar"
        name="budgetSearch"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ex.: aluguel, mercado…"
      />
      {mode === 'Simple' && editableIds.size === 0 ? (
        <p className={styles.muted}>No modo simples, edite valores nas categorias já planejadas ou mude para detalhado.</p>
      ) : null}
      <ErrorText message={action.error} />
      {visibleRoots.length === 0 && mode === 'Detailed' ? <Empty>Nenhuma conta de despesa.</Empty> : null}
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
              <Badge>Soma</Badge>
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
