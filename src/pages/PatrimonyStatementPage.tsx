import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { entriesApi, entryDisplayDescription, patrimonyApi, type Entry, type PatrimonyItem } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import {
  downloadStatementCsv,
  downloadStatementPdf,
  moneyCell,
  statementFileName,
  type StatementExportRow,
} from './patrimonyStatementExport'
import { useLoad } from '../hooks/useLoad'
import { formatMoney } from '../lib/format'
import pageStyles from './pageStyles'
import cadastroStyles from './cadastros/cadastros.module.css'

const styles = { ...pageStyles, ...cadastroStyles }

function sameItemName(description: string, name: string) {
  return description.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0
}

async function entriesForItem(item: PatrimonyItem, items: PatrimonyItem[]): Promise<Entry[]> {
  const pageSize = 200
  const first = await entriesApi.list({ categoryId: item.categoryId, skip: 0, take: pageSize })
  const loaded = [...first.items]
  while (loaded.length < first.totalCount) {
    const next = await entriesApi.list({
      categoryId: item.categoryId,
      skip: loaded.length,
      take: pageSize,
    })
    if (next.items.length === 0) {
      break
    }
    loaded.push(...next.items)
  }

  const peers = items.filter((peer) => peer.categoryId === item.categoryId)
  const movements = loaded.filter((entry) => entry.type === 'Income' || entry.type === 'Expense')
  const matched =
    peers.length <= 1
      ? movements
      : movements.filter((entry) => sameItemName(entry.description, item.name))

  return matched.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
}

function openingAmount(current: number, entries: Entry[]) {
  const credits = entries
    .filter((entry) => entry.type === 'Income')
    .reduce((sum, entry) => sum + entry.amount, 0)
  const debits = entries
    .filter((entry) => entry.type === 'Expense')
    .reduce((sum, entry) => sum + entry.amount, 0)
  return current - credits + debits
}

export function PatrimonyStatementPage() {
  const { id = '' } = useParams()
  const summary = useLoad(() => patrimonyApi.get(), [])
  const item = useMemo(
    () => summary.data?.items.find((row) => row.id === id) ?? null,
    [summary.data, id],
  )
  const statement = useLoad(
    () => (item && summary.data ? entriesForItem(item, summary.data.items) : Promise.resolve([])),
    [item?.id, item?.categoryId, item?.name, summary.data],
  )
  const entries = statement.data ?? []
  const initial = item ? openingAmount(item.amount, entries) : 0
  const balanceLabel = item?.section === 'Liability' ? 'Saldo do passivo' : 'Saldo do ativo'
  const lines = useMemo(() => {
    let balance = initial
    return entries.map((entry) => {
      const positive = entry.type === 'Income'
      balance += positive ? entry.amount : -entry.amount
      return { entry, positive, balance }
    })
  }, [entries, initial])
  const finalBalance = lines.at(-1)?.balance ?? initial
  const finalLabel = item?.section === 'Liability' ? 'Saldo final do passivo' : 'Saldo final do ativo'

  function exportRows(): StatementExportRow[] {
    return [
      { name: 'Valor inicial', amount: moneyCell(initial), balance: moneyCell(initial) },
      ...lines.map((line) => ({
        name: entryDisplayDescription(line.entry),
        amount: moneyCell(line.positive ? line.entry.amount : -line.entry.amount),
        balance: moneyCell(line.balance),
      })),
      { name: finalLabel, amount: '', balance: moneyCell(finalBalance) },
    ]
  }

  function exportCsv() {
    if (!item) {
      return
    }
    downloadStatementCsv(statementFileName(item.name, 'csv'), exportRows())
  }

  function exportPdf() {
    if (!item) {
      return
    }
    downloadStatementPdf(statementFileName(item.name, 'pdf'), `Extrato de ${item.name}`, exportRows())
  }

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Patrimônio"
        title={item ? `Extrato de ${item.name}` : 'Extrato'}
        actions={
          item && !statement.loading ? (
            <>
              <Button variant="secondary" onClick={exportCsv}>
                Exportar CSV
              </Button>
              <Button variant="secondary" onClick={exportPdf}>
                Exportar PDF
              </Button>
            </>
          ) : null
        }
      />
      <ErrorText message={summary.error ?? statement.error} />
      {summary.loading && !summary.data ? <Loading /> : null}
      {!summary.loading && summary.data && !item ? (
        <ErrorText message="Item de patrimônio não encontrado." />
      ) : null}

      {item && statement.loading ? <Loading /> : null}

      {item && !statement.loading ? (
        <>
          <ul className={styles.list}>
            <li className={styles.statementEntry}>
              <div className={styles.statementLine}>
                <strong>Valor inicial</strong>
                <span className={`${styles.amount} ${styles.moneyValue}`}>{formatMoney(initial)}</span>
              </div>
            </li>
            {lines.map((line) => (
              <li key={line.entry.id} className={styles.statementEntry}>
                <div className={styles.statementLine}>
                  <strong>{entryDisplayDescription(line.entry)}</strong>
                  <span
                    className={`${styles.amount} ${styles.moneyValue} ${line.positive ? styles.statementCredit : styles.statementDebit}`}
                  >
                    {formatMoney(line.entry.amount)}
                  </span>
                </div>
                <div className={styles.statementLine}>
                  <span className={styles.rowSub}>{balanceLabel}</span>
                  <span className={`${styles.amount} ${styles.moneyValue}`}>{formatMoney(line.balance)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {item ? (
        <p className={styles.muted}>
          <Link to={`/patrimonio/${item.id}`} className={styles.cadastroDetailBack}>
            ← Voltar ao item
          </Link>
        </p>
      ) : null}
    </div>
  )
}
