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
import { currentCompetence, formatCompetence, formatMoney, formatPercent } from '../lib/format'
import styles from './page.module.css'

type Totals = { planned: number; actual: number }

function descendantIds(rootId: string, byParent: Map<string | null, ChartAccount[]>): Set<string> {
  const ids = new Set<string>([rootId])
  const walk = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      ids.add(child.id)
      walk(child.id)
    }
  }
  walk(rootId)
  return ids
}

function sumBranch(
  accountId: string,
  byParent: Map<string | null, ChartAccount[]>,
  planned: Map<string, number>,
  actual: Map<string, number>,
): Totals {
  const ids = descendantIds(accountId, byParent)
  let plannedTotal = 0
  let actualTotal = 0
  for (const id of ids) {
    plannedTotal += planned.get(id) ?? 0
    actualTotal += actual.get(id) ?? 0
  }
  return { planned: plannedTotal, actual: actualTotal }
}

function TotalsCell({ totals }: { totals: Totals }) {
  const variation = totals.planned - totals.actual
  const percent = totals.planned === 0 ? null : (totals.actual / totals.planned) * 100
  return (
    <span className={styles.raioxTotals}>
      <span>{formatMoney(totals.planned)}</span>
      <span>{formatMoney(totals.actual)}</span>
      <span className={variation < 0 ? styles.negative : undefined}>
        {formatMoney(variation)}
        {percent === null ? '' : ` · ${formatPercent(percent)}`}
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
    const map = new Map<string | null, ChartAccount[]>()
    for (const account of list) {
      const bucket = map.get(account.parentId) ?? []
      bucket.push(account)
      map.set(account.parentId, bucket)
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
    }
    return map
  }, [list])

  const planned = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of budget.data?.lines ?? []) {
      if (line.chartAccountId && !line.isGroup) {
        map.set(line.chartAccountId, line.plannedAmount)
      }
    }
    return map
  }, [budget.data])

  const actual = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of budget.data?.lines ?? []) {
      if (line.chartAccountId) {
        map.set(line.chartAccountId, (map.get(line.chartAccountId) ?? 0) + line.actualAmount)
      }
    }
    return map
  }, [budget.data])

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

  function entriesFor(account: ChartAccount): Entry[] {
    const ids = descendantIds(account.id, byParent)
    return (entries.data?.items ?? []).filter(
      (entry) => entry.chartAccountId && ids.has(entry.chartAccountId),
    )
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
            <RootBlock
              key={root.id}
              root={root}
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

function RootBlock({
  root,
  byParent,
  planned,
  actual,
  open,
  onToggle,
  entriesFor,
  onOpenEntry,
}: {
  root: ChartAccount
  byParent: Map<string | null, ChartAccount[]>
  planned: Map<string, number>
  actual: Map<string, number>
  open: Set<string>
  onToggle: (id: string) => void
  entriesFor: (account: ChartAccount) => Entry[]
  onOpenEntry: (entry: Entry) => void
}) {
  const expanded = open.has(root.id)
  const children = byParent.get(root.id) ?? []
  const totals = sumBranch(root.id, byParent, planned, actual)

  return (
    <>
      <button type="button" className={`${styles.raioxRow} ${styles.raioxRoot}`} onClick={() => onToggle(root.id)}>
        <span className={styles.raioxToggle} aria-hidden>
          {expanded ? '−' : '+'}
        </span>
        <strong>{chartAccountLabel(root)}</strong>
        <TotalsCell totals={totals} />
      </button>
      {expanded
        ? children.map((child) => (
            <GroupBlock
              key={child.id}
              account={child}
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
    </>
  )
}

function GroupBlock({
  account,
  byParent,
  planned,
  actual,
  open,
  onToggle,
  entriesFor,
  onOpenEntry,
}: {
  account: ChartAccount
  byParent: Map<string | null, ChartAccount[]>
  planned: Map<string, number>
  actual: Map<string, number>
  open: Set<string>
  onToggle: (id: string) => void
  entriesFor: (account: ChartAccount) => Entry[]
  onOpenEntry: (entry: Entry) => void
}) {
  const expanded = open.has(account.id)
  const totals = sumBranch(account.id, byParent, planned, actual)
  const monthEntries = expanded ? entriesFor(account) : []

  return (
    <>
      <button type="button" className={`${styles.raioxRow} ${styles.raioxGroup}`} onClick={() => onToggle(account.id)}>
        <span className={styles.raioxToggle} aria-hidden>
          {expanded ? '−' : '+'}
        </span>
        <strong>{chartAccountLabel(account)}</strong>
        <TotalsCell totals={totals} />
      </button>
      {expanded
        ? monthEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`${styles.raioxRow} ${styles.raioxEntry}`}
              onClick={() => onOpenEntry(entry)}
            >
              <span />
              <span className={styles.rowMain}>
                <strong>{entry.description || 'Lançamento'}</strong>
                <span className={styles.rowSub}>{entry.competenceYm}</span>
              </span>
              <span className={styles.raioxTotals}>
                <span />
                <span>{formatMoney(entry.amount)}</span>
                <span />
              </span>
            </button>
          ))
        : null}
      {expanded && monthEntries.length === 0 ? (
        <div className={`${styles.raioxRow} ${styles.raioxEntry}`}>
          <span />
          <span className={styles.muted}>Nenhum lançamento neste ramo.</span>
          <span />
        </div>
      ) : null}
    </>
  )
}
