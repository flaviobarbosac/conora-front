import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { entriesApi, type Entry, type EntryInput, type EntryType } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { IntegerField } from '../components/ui/IntegerField'
import { MoneyField } from '../components/ui/MoneyField'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { scanReceipt } from '../camera/scanReceipt'
import { confirmDestructive } from '../lib/confirm'
import { currentCompetence, dateToApi, formatDate, formatMoney, parseMoney, todayInput } from '../lib/format'
import { peekPendingShare } from '../share/pendingShare'
import styles from './page.module.css'

type FormType = Extract<EntryType, 'Expense' | 'Income' | 'Transfer'>

const TYPE_LABEL: Record<EntryType, string> = {
  Expense: 'Despesa',
  Income: 'Receita',
  Transfer: 'Transferência',
  Contribution: 'Aporte',
  CardPayment: 'Pagamento de fatura',
  ProjectContribution: 'Aporte em projeto',
}

const FORM_TYPES: FormType[] = ['Expense', 'Income', 'Transfer']

function amountClass(type: EntryType): string | undefined {
  if (type === 'Income') {
    return styles.positive
  }
  return type === 'Transfer' ? undefined : styles.negative
}

export function EntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ym, setYm] = useState(currentCompetence)
  const [typeFilter, setTypeFilter] = useState<EntryType | ''>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setShowForm(true)
      const next = new URLSearchParams(searchParams)
      next.delete('novo')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const lookups = useLookups()
  const entries = useLoad(
    () =>
      entriesApi.list({
        competenceYm: ym,
        type: typeFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: appliedSearch || undefined,
        take: 100,
      }),
    [ym, typeFilter, categoryFilter, appliedSearch],
  )
  const rowAction = useAction()

  async function duplicate(entry: Entry) {
    if (await rowAction.run(() => entriesApi.duplicate(entry.id))) {
      entries.reload()
    }
  }

  async function remove(entry: Entry) {
    if (!(await confirmDestructive(`Excluir "${entry.description}"?`, { title: 'Excluir lançamento' }))) {
      return
    }
    if (await rowAction.run(() => entriesApi.remove(entry.id))) {
      entries.reload()
    }
  }

  function describe(entry: Entry): string {
    const parts = [formatDate(entry.occurredAt), lookups.accountName(entry.accountId)]
    if (entry.type === 'Transfer') {
      parts.push(`→ ${lookups.accountName(entry.contraAccountId)}`)
    } else if (entry.categoryId) {
      parts.push(lookups.categoryName(entry.categoryId))
    }
    return parts.join(' · ')
  }

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Movimentações"
        title="Lançamentos"
        actions={
          <>
            <CompetencePicker value={ym} onChange={setYm} />
            <Button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Fechar' : '+ Novo lançamento'}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                void scanReceipt()
                  .then(() => setShowForm(true))
                  .catch(() => undefined)
              }}
            >
              Escanear recibo
            </Button>
          </>
        }
      />

      {showForm ? (
        <EntryForm
          accounts={lookups.accounts.map((account) => ({ id: account.id, name: account.name }))}
          categories={lookups.categories}
          onSaved={() => {
            setShowForm(false)
            entries.reload()
            lookups.reloadAccounts()
          }}
        />
      ) : null}

      <section className={styles.section}>
        <form
          className={styles.toolbar}
          onSubmit={(event) => {
            event.preventDefault()
            setAppliedSearch(search.trim())
          }}
        >
          <Field label="Buscar" name="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select label="Tipo" name="typeFilter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as EntryType | '')}>
            <option value="">Todos</option>
            {FORM_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
          <Select label="Categoria" name="categoryFilter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Todas</option>
            {lookups.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <ErrorText message={entries.error ?? rowAction.error} />
        {entries.loading && !entries.data ? <Loading /> : null}
        {entries.data && entries.data.items.length === 0 ? <Empty>Nenhum lançamento nesta competência.</Empty> : null}
        {entries.data && entries.data.items.length > 0 ? (
          <ul className={styles.list}>
            {entries.data.items.map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <strong>
                    {entry.description}
                    {entry.installmentCount ? ` (${entry.installmentNumber}/${entry.installmentCount})` : ''}
                  </strong>
                  <span className={styles.rowSub}>{describe(entry)}</span>
                </span>
                <span className={styles.rowEnd}>
                  <Badge>{TYPE_LABEL[entry.type]}</Badge>
                  <span className={`${styles.amount} ${amountClass(entry.type) ?? ''}`}>
                    {entry.type === 'Expense' ? '− ' : ''}
                    {formatMoney(entry.amount)}
                  </span>
                  <Button variant="ghost" disabled={rowAction.busy} onClick={() => void duplicate(entry)}>
                    Duplicar
                  </Button>
                  <Button variant="ghost" disabled={rowAction.busy} onClick={() => void remove(entry)}>
                    Excluir
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {entries.data ? (
          <p className={styles.rowSub}>
            {entries.data.totalCount} lançamento(s) em {ym}
          </p>
        ) : null}
      </section>
    </div>
  )
}

type FormProps = {
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string; kind: string }[]
  onSaved: () => void
}

function EntryForm({ accounts, categories, onSaved }: FormProps) {
  const [type, setType] = useState<FormType>('Expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayInput)
  const pendingReceipt = peekPendingShare()
  const [description, setDescription] = useState(pendingReceipt ? pendingReceipt.fileName.replace(/\.[^.]+$/, '') : '')
  const [receiptPreview] = useState(pendingReceipt?.dataUrl ?? '')
  const [accountId, setAccountId] = useState('')
  const [contraAccountId, setContraAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [installments, setInstallments] = useState('')
  const [repeat, setRepeat] = useState('')
  const action = useAction()

  const kindCategories = categories.filter((category) => category.kind === type)

  async function suggest() {
    if (type === 'Transfer' || categoryId || description.trim().length < 3) {
      return
    }
    try {
      const suggestion = await entriesApi.suggestCategory(description.trim())
      if (suggestion.categoryId && kindCategories.some((category) => category.id === suggestion.categoryId)) {
        setCategoryId(suggestion.categoryId)
      }
    } catch {
      // suggestion is optional
    }
  }

  async function submit(confirmDuplicate: boolean) {
    const value = parseMoney(amount)
    if (!Number.isFinite(value) || value <= 0) {
      action.setError('Informe um valor maior que zero.')
      return
    }

    const input: EntryInput = {
      type,
      amount: value,
      occurredAt: dateToApi(date),
      description: description.trim(),
      accountId: accountId || undefined,
      contraAccountId: type === 'Transfer' ? contraAccountId || undefined : undefined,
      categoryId: type === 'Transfer' ? undefined : categoryId || undefined,
      installmentCount: Number(installments) > 1 ? Number(installments) : undefined,
      repeatMonths: Number(repeat) > 1 ? Number(repeat) : undefined,
      confirmDuplicate,
    }

    if (await action.run(() => entriesApi.create(input))) {
      onSaved()
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await submit(false)
  }

  const looksLikeDuplicate = /duplic/i.test(action.error ?? '')

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Novo lançamento</h2>
      <div className={styles.segmented} role="group" aria-label="Tipo de lançamento">
        {FORM_TYPES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={type === option}
            onClick={() => {
              setType(option)
              setCategoryId('')
            }}
          >
            {TYPE_LABEL[option]}
          </button>
        ))}
      </div>
      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        {receiptPreview ? <img className={styles.sharePreview} src={receiptPreview} alt="Recibo anexado" /> : null}
        <MoneyField label="Valor (R$)" name="amount" required value={amount} onChange={setAmount} />
        <Field label="Data" name="date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        <div className={styles.formWide}>
          <Field
            label="Descrição"
            name="description"
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => void suggest()}
          />
        </div>
        <Select label={type === 'Transfer' ? 'Conta de origem' : 'Conta'} name="accountId" required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Selecione</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        {type === 'Transfer' ? (
          <Select label="Conta de destino" name="contraAccountId" required value={contraAccountId} onChange={(event) => setContraAccountId(event.target.value)}>
            <option value="">Selecione</option>
            {accounts
              .filter((account) => account.id !== accountId)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </Select>
        ) : (
          <Select label="Categoria" name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Sem categoria</option>
            {kindCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        )}
        {type === 'Expense' ? (
          <IntegerField
            label="Parcelas (opcional)"
            hint="Divide o valor, uma parte por mês."
            name="installments"
            maxLength={2}
            value={installments}
            onChange={setInstallments}
          />
        ) : null}
        {type !== 'Transfer' ? (
          <IntegerField
            label="Repetir por meses (opcional)"
            hint="Repete o valor cheio a cada mês."
            name="repeat"
            maxLength={2}
            value={repeat}
            onChange={setRepeat}
          />
        ) : null}
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Salvar
          </Button>
          {looksLikeDuplicate ? (
            <Button variant="secondary" disabled={action.busy} onClick={() => void submit(true)}>
              Salvar mesmo assim
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
