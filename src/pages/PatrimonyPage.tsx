import { useState, type FormEvent } from 'react'
import { patrimonyApi, type PatrimonyItem } from '../api/finance'
import { ChartAccountSelect } from '../components/ChartAccountSelect'
import { PageHeader } from '../components/PageHeader'
import { Pager } from '../components/Pager'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useClientPagination } from '../hooks/useClientPagination'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { formatMoney, parseMoney } from '../lib/format'
import styles from './page.module.css'

export function PatrimonyPage() {
  const summary = useLoad(() => patrimonyApi.get(), [])
  const reserve = useLoad(() => patrimonyApi.reserve(), [])
  const remove = useAction()
  const data = summary.data
  const items = data?.items ?? []
  const pagination = useClientPagination(items, 10)

  async function removeItem(item: PatrimonyItem) {
    if (!(await confirmDestructive(`Excluir "${item.name}"?`, { title: 'Excluir item' }))) {
      return
    }
    if (await remove.run(() => patrimonyApi.remove(item.id))) {
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
            <strong className={`${styles.moneyValue} ${data.netWorth < 0 ? styles.negative : ''}`}>
              {formatMoney(data.netWorth)}
            </strong>
            <span>
              Contas {formatMoney(data.accountsBalance)} + uso {formatMoney(data.assetsInUse)} + não uso{' '}
              {formatMoney(data.assetsNotInUse)} − passivos {formatMoney(data.liabilitiesTotal)} − faturas{' '}
              {formatMoney(data.unpaidCardInvoices)}
            </span>
          </section>
          {data.groups.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Totais por grupo</h2>
              <ul className={styles.list}>
                {data.groups.map((group) => (
                  <li key={`${group.section}-${group.groupName}`} className={styles.row}>
                    <span className={styles.rowMain}>
                      <strong>{group.groupName}</strong>
                      <span className={styles.rowSub}>{group.section === 'Asset' ? 'Ativo' : 'Passivo'}</span>
                    </span>
                    <span className={`${styles.amount} ${styles.moneyValue}`}>{formatMoney(group.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {reserve.data ? (
            <div className={styles.stat}>
              <span>Reserva sugerida (média de gastos essenciais · {reserve.data.monthsConsidered} mês(es))</span>
              <strong className={styles.moneyValue}>{formatMoney(reserve.data.monthlyEssentialAverage)}</strong>
            </div>
          ) : null}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Itens</h2>
            {data.items.length === 0 ? <Empty>Nenhum item cadastrado.</Empty> : null}
            <ul className={styles.list}>
              {pagination.pageItems.map((item) => (
                <li key={item.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>{item.name}</strong>
                    <span className={styles.rowSub}>
                      {item.chartAccountName} · {item.groupName}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <Badge tone={item.section === 'Asset' ? 'ok' : 'danger'}>
                      {item.section === 'Asset' ? 'Ativo' : 'Passivo'}
                    </Badge>
                    <span className={`${styles.amount} ${styles.moneyValue}`}>{formatMoney(item.amount)}</span>
                    <DeleteIconButton disabled={remove.busy} onClick={() => void removeItem(item)} />
                  </span>
                </li>
              ))}
            </ul>
            <Pager
              page={pagination.page}
              pageCount={pagination.pageCount}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
            />
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
  const lookups = useLookups()
  const options = lookups.patrimonyAccounts
  const [chartAccountId, setChartAccountId] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!chartAccountId) {
      action.setError('Escolha a conta do plano.')
      return
    }
    if (!name.trim()) {
      action.setError('Informe o nome do item.')
      return
    }
    if (!Number.isFinite(value) || value < 0) {
      action.setError('Valor inválido.')
      return
    }
    if (await action.run(() => patrimonyApi.create(chartAccountId, name.trim(), value))) {
      showSaveToast('Item de patrimônio salvo.')
      setChartAccountId('')
      setName('')
      setAmount('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Novo item</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <ChartAccountSelect
          label="Conta do plano"
          name="patrimonyAccount"
          required
          value={chartAccountId}
          onChange={setChartAccountId}
          options={options}
          tree={lookups.chartAccounts}
          emptyLabel="Selecione"
        />
        <Field
          label="Nome do item"
          name="patrimonyName"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Civic 2018, apartamento, empréstimo X"
        />
        <MoneyField label="Valor (R$)" name="patrimonyAmount" required value={amount} onChange={setAmount} />
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy || options.length === 0}>
            Adicionar
          </Button>
        </div>
      </form>
    </section>
  )
}
