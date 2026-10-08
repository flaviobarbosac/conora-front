import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  budgetsApi,
  chartAccountsApi,
  entriesApi,
  type Budget,
  type ChartAccount,
  type Entry,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useLoad } from '../hooks/useLoad'
import { chartAccountLabel } from '../lib/chartLabel'
import { compareChartSiblings } from '../lib/chartOrder'
import { currentCompetence, formatCompetence, formatMoney, formatPercent } from '../lib/format'
import {
  buildAmountMaps,
  groupAccountsByParent,
  sumBranch,
  variationPercent,
  type RaioXTotals,
} from '../lib/raioX'
import styles from './page.module.css'

function TotalsCell({ totals }: { totals: RaioXTotals }) {
  const percent = variationPercent(totals)
  const tone =
    percent === null ? undefined : percent < 0 ? styles.negative : percent > 0 ? styles.positive : undefined
  return (
    <span className={styles.raioxTotals}>
      <span className={styles.raioxAmount}>{formatMoney(totals.planned)}</span>
      <span className={styles.raioxAmount}>{formatMoney(totals.actual)}</span>
      <span className={`${styles.raioxPercent} ${tone ?? ''}`}>
        {percent === null ? '—' : formatPercent(percent)}
      </span>
    </span>
  )
}

export function RaioXPage() {
  const navigate = useNavigate()
  const [ym, setYm] = useState(currentCompetence)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const budget = useLoad(() => budgetsApi.get(ym), [ym])
  const accounts = useLoad(() => chartAccountsApi.list(undefined, false, false), [])
  const entries = useLoad(() => entriesApi.list({ competenceYm: ym, take: 200 }), [ym])

  const list = accounts.data ?? []
  const byParent = useMemo(() => {
    const map = groupAccountsByParent(list)
    for (const bucket of map.values()) {
      bucket.sort(compareChartSiblings)
    }
    return map
  }, [list])

  const { planned, actual } = useMemo(
    () => buildAmountMaps(budget.data?.lines ?? []),
    [budget.data],
  )

  const roots = useMemo(
    () => (byParent.get(null) ?? []).filter((account) => account.level === 'Root'),
    [byParent],
  )

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

  function entriesFor(accountId: string): Entry[] {
    return (entries.data?.items ?? []).filter((entry) => entry.chartAccountId === accountId)
  }

  function openEntry(entry: Entry) {
    const params = new URLSearchParams({ competenceYm: ym })
    if (entry.chartAccountId) {
      params.set('chartAccountId', entry.chartAccountId)
    }
    navigate(`/lancamentos?${params.toString()}`)
  }

  const data = budget.data

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Visão"
        title="Raio-X"
        actions={<CompetencePicker value={ym} onChange={setYm} />}
      />
      <ErrorText message={budget.error ?? accounts.error ?? entries.error} />
      {budget.loading && !data ? <Loading /> : null}
      {data ? <IncomeHero budget={data} /> : null}
      {accounts.loading && !accounts.data ? <Loading /> : null}
      {roots.length > 0 ? (
        <div className={styles.raioxList}>
          <div className={`${styles.raioxRow} ${styles.raioxHead}`}>
            <span />
            <span>Conta</span>
            <span className={styles.raioxTotals}>
              <span>Previsto</span>
              <span>Realizado</span>
              <span>Variação</span>
            </span>
          </div>
          {roots.map((root) => (
            <AccountBlock
              key={root.id}
              account={root}
              depth={0}
              byParent={byParent}
              planned={planned}
              actual={actual}
              open={open}
              onToggle={toggle}
              entriesFor={entriesFor}
              onOpenEntry={openEntry}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function IncomeHero({ budget }: { budget: Budget }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroTop}>
        <span>Raio-X · {formatCompetence(budget.competenceYm)}</span>
      </div>
      <div className={styles.heroSplit} aria-label="Receita prevista e recebida">
        <div>
          <span>Receita prevista</span>
          <strong>{formatMoney(budget.spendableIncome)}</strong>
        </div>
        <div>
          <span>Receita recebida</span>
          <strong className={styles.positive}>{formatMoney(budget.receivedIncome)}</strong>
        </div>
      </div>
    </section>
  )
}

function AccountBlock({
  account,
  depth,
  byParent,
  planned,
  actual,
  open,
  onToggle,
  entriesFor,
  onOpenEntry,
}: {
  account: ChartAccount
  depth: number
  byParent: Map<string | null, ChartAccount[]>
  planned: Map<string, number>
  actual: Map<string, number>
  open: Set<string>
  onToggle: (id: string) => void
  entriesFor: (accountId: string) => Entry[]
  onOpenEntry: (entry: Entry) => void
}) {
  const children = byParent.get(account.id) ?? []
  const monthEntries = account.level === 'Analytical' ? entriesFor(account.id) : []
  const expandable = children.length > 0 || monthEntries.length > 0
  const expanded = open.has(account.id)
  const totals = sumBranch(account.id, byParent, planned, actual)
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
        className={`${styles.raioxRow} ${rowClass}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
        onClick={() => (expandable ? onToggle(account.id) : undefined)}
        aria-expanded={expandable ? expanded : undefined}
      >
        <span className={styles.raioxToggle} aria-hidden>
          {expandable ? (expanded ? '−' : '+') : ''}
        </span>
        <strong className={styles.raioxAccountName}>{chartAccountLabel(account)}</strong>
        <TotalsCell totals={totals} />
      </button>
      {expanded
        ? children.map((child) => (
            <AccountBlock
              key={child.id}
              account={child}
              depth={depth + 1}
              byParent={byParent}
              planned={planned}
              actual={actual}
              open={open}
              onToggle={onToggle}
              entriesFor={entriesFor}
              onOpenEntry={onOpenEntry}
            />
          ))
        : null}
      {expanded && monthEntries.length > 0
        ? monthEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`${styles.raioxRow} ${styles.raioxEntry}`}
              style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
              onClick={() => onOpenEntry(entry)}
            >
              <span />
              <span className={styles.rowMain}>
                <strong>{entry.description || 'Lançamento'}</strong>
                <span className={styles.rowSub}>{entry.competenceYm}</span>
              </span>
              <span className={styles.raioxTotals}>
                <span className={styles.raioxAmount} />
                <span className={styles.raioxAmount}>{formatMoney(entry.amount)}</span>
                <span className={styles.raioxPercent} />
              </span>
            </button>
          ))
        : null}
      {expanded && children.length === 0 && monthEntries.length === 0 ? (
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
