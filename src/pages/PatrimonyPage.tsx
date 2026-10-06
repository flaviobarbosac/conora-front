import { useState, type FormEvent } from 'react'
import { patrimonyApi, type PatrimonyItem, type PatrimonyKind } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { formatMoney, parseMoney } from '../lib/format'
import styles from './page.module.css'

const KIND_LABEL: Record<PatrimonyKind, string> = { Asset: 'Bem / ativo', Liability: 'Dívida / passivo' }

export function PatrimonyPage() {
  const summary = useLoad(() => patrimonyApi.get(), [])
  const reserve = useLoad(() => patrimonyApi.reserve(), [])
  const remove = useAction()
  const data = summary.data

  async function removeItem(item: PatrimonyItem) {
    if (window.confirm(`Excluir "${item.name}"?`) && (await remove.run(() => patrimonyApi.remove(item.id)))) {
      summary.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Patrimônio" />
      <ErrorText message={summary.error ?? reserve.error ?? remove.error} />
      {summary.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.hero}>
            <span>Patrimônio líquido</span>
            <strong className={data.netWorth < 0 ? styles.negative : undefined}>{formatMoney(data.netWorth)}</strong>
            <span>
              Saldo em contas {formatMoney(data.accountsBalance)} + bens {formatMoney(data.assetsTotal)} − dívidas{' '}
              {formatMoney(data.liabilitiesTotal)} − faturas em aberto {formatMoney(data.unpaidCardInvoices)}
            </span>
          </section>
          {reserve.data ? (
            <div className={styles.stat}>
              <span>Reserva sugerida (média de gastos essenciais · {reserve.data.monthsConsidered} mês(es))</span>
              <strong>{formatMoney(reserve.data.monthlyEssentialAverage)}</strong>
            </div>
          ) : null}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Bens e dívidas</h2>
            {data.items.length === 0 ? <Empty>Nenhum item cadastrado.</Empty> : null}
            <ul className={styles.list}>
              {data.items.map((item) => (
                <li key={item.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>{item.name}</strong>
                  </span>
                  <span className={styles.rowEnd}>
                    <Badge tone={item.kind === 'Asset' ? 'ok' : 'danger'}>{KIND_LABEL[item.kind]}</Badge>
                    <span className={styles.amount}>{formatMoney(item.amount)}</span>
                    <Button variant="ghost" disabled={remove.busy} onClick={() => void removeItem(item)}>
                      Excluir
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
      <ItemForm
        onSaved={() => {
          summary.reload()
          reserve.reload()
        }}
      />
    </div>
  )
}

function ItemForm({ onSaved }: { onSaved: () => void }) {
  const [kind, setKind] = useState<PatrimonyKind>('Asset')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!Number.isFinite(value) || value < 0) {
      action.setError('Valor inválido.')
      return
    }
    if (await action.run(() => patrimonyApi.create(kind, name.trim(), value))) {
      setName('')
      setAmount('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Novo item</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Select label="Tipo" name="patrimonyKind" value={kind} onChange={(event) => setKind(event.target.value as PatrimonyKind)}>
          <option value="Asset">{KIND_LABEL.Asset}</option>
          <option value="Liability">{KIND_LABEL.Liability}</option>
        </Select>
        <Field label="Nome" name="patrimonyName" required value={name} onChange={(event) => setName(event.target.value)} />
        <Field label="Valor (R$)" name="patrimonyAmount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Adicionar
          </Button>
        </div>
      </form>
    </section>
  )
}
