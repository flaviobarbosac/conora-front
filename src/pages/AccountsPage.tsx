import { useState, type FormEvent } from 'react'
import {
  accountsApi,
  cardsApi,
  type Account,
  type AccountKind,
  type Card,
  type Category,
  type InvoiceStatus,
} from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { currentCompetence, dateToApi, formatDate, formatMoney, parseMoney, todayInput } from '../lib/format'
import styles from './page.module.css'

const KIND_LABEL: Record<AccountKind, string> = {
  Checking: 'Conta corrente',
  Cash: 'Dinheiro',
  Other: 'Outra',
}

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  Open: 'Aberta',
  Closed: 'Fechada',
  Paid: 'Paga',
}

export function AccountsPage() {
  const lookups = useLookups()
  const accounts = useLoad(() => accountsApi.list(true), [])
  const cards = useLoad(() => cardsApi.list(), [])
  const archive = useAction()

  function refresh() {
    accounts.reload()
    lookups.reloadAccounts()
  }

  async function toggleArchive(account: Account) {
    if (await archive.run(() => accountsApi.archive(account.id, !account.isArchived))) {
      refresh()
    }
  }

  const activeAccounts = (accounts.data ?? []).filter((account) => !account.isArchived)

  return (
    <div className={styles.page}>
      <PageHeader kicker="Dinheiro" title="Contas e cartões" />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Contas</h2>
        <ErrorText message={accounts.error ?? archive.error} />
        {accounts.loading && !accounts.data ? <Loading /> : null}
        {accounts.data && accounts.data.length === 0 ? <Empty>Nenhuma conta cadastrada.</Empty> : null}
        {accounts.data && accounts.data.length > 0 ? (
          <ul className={styles.list}>
            {accounts.data.map((account) => (
              <li key={account.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <strong>{account.name}</strong>
                  <span className={styles.rowSub}>{KIND_LABEL[account.kind]}</span>
                </span>
                <span className={styles.rowEnd}>
                  {account.isArchived ? <Badge tone="warning">Arquivada</Badge> : null}
                  <span className={styles.amount}>{formatMoney(account.balance)}</span>
                  <Button variant="ghost" disabled={archive.busy} onClick={() => void toggleArchive(account)}>
                    {account.isArchived ? 'Reativar' : 'Arquivar'}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className={styles.grid2}>
        <AccountForm onSaved={refresh} />
        <TransferForm accounts={activeAccounts} onSaved={refresh} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cartões de crédito</h2>
        <ErrorText message={cards.error} />
        {cards.loading && !cards.data ? <Loading /> : null}
        {cards.data && cards.data.length === 0 ? <Empty>Nenhum cartão cadastrado.</Empty> : null}
        {cards.data?.map((card) => (
          <CardPanel
            key={card.id}
            card={card}
            accounts={activeAccounts}
            categories={lookups.categories.filter((category) => category.kind === 'Expense')}
            onChanged={() => {
              cards.reload()
              refresh()
            }}
          />
        ))}
      </section>

      <CardForm accounts={activeAccounts} onSaved={cards.reload} />
    </div>
  )
}

function AccountForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('Checking')
  const [balance, setBalance] = useState('')
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const opening = balance.trim() ? parseMoney(balance) : 0
    if (!Number.isFinite(opening)) {
      action.setError('Saldo inicial inválido.')
      return
    }
    if (await action.run(() => accountsApi.create(name.trim(), kind, opening))) {
      setName('')
      setBalance('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Nova conta</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field label="Nome" name="accountName" required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <Select label="Tipo" name="accountKind" value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
          {(Object.keys(KIND_LABEL) as AccountKind[]).map((option) => (
            <option key={option} value={option}>
              {KIND_LABEL[option]}
            </option>
          ))}
        </Select>
        <Field label="Saldo inicial (R$)" name="openingBalance" inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} />
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Criar conta
          </Button>
        </div>
      </form>
    </section>
  )
}

function TransferForm({ accounts, onSaved }: { accounts: Account[]; onSaved: () => void }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayInput)
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!Number.isFinite(value) || value <= 0) {
      action.setError('Informe um valor maior que zero.')
      return
    }
    if (await action.run(() => accountsApi.transfer(from, to, value, dateToApi(date)))) {
      setAmount('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Transferir entre contas</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Select label="De" name="transferFrom" required value={from} onChange={(event) => setFrom(event.target.value)}>
          <option value="">Selecione</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <Select label="Para" name="transferTo" required value={to} onChange={(event) => setTo(event.target.value)}>
          <option value="">Selecione</option>
          {accounts
            .filter((account) => account.id !== from)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </Select>
        <Field label="Valor (R$)" name="transferAmount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Field label="Data" name="transferDate" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Transferir
          </Button>
        </div>
      </form>
    </section>
  )
}

function CardForm({ accounts, onSaved }: { accounts: Account[]; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('')
  const [closing, setClosing] = useState('')
  const [due, setDue] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const limitTotal = parseMoney(limit)
    if (!Number.isFinite(limitTotal) || limitTotal < 0) {
      action.setError('Limite inválido.')
      return
    }
    const saved = await action.run(() =>
      cardsApi.create(name.trim(), limitTotal, Number(closing), Number(due), paymentAccountId || undefined),
    )
    if (saved) {
      setName('')
      setLimit('')
      setClosing('')
      setDue('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Novo cartão</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Nome" name="cardName" required value={name} onChange={(event) => setName(event.target.value)} />
        <Field label="Limite (R$)" name="cardLimit" inputMode="decimal" required value={limit} onChange={(event) => setLimit(event.target.value)} />
        <Field label="Dia de fechamento" name="closingDay" type="number" min={1} max={31} required value={closing} onChange={(event) => setClosing(event.target.value)} />
        <Field label="Dia de vencimento" name="dueDay" type="number" min={1} max={31} required value={due} onChange={(event) => setDue(event.target.value)} />
        <Select label="Conta de pagamento" name="paymentAccount" value={paymentAccountId} onChange={(event) => setPaymentAccountId(event.target.value)}>
          <option value="">Escolher ao pagar</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Criar cartão
          </Button>
        </div>
      </form>
    </section>
  )
}

type PanelProps = {
  card: Card
  accounts: Account[]
  categories: Category[]
  onChanged: () => void
}

function CardPanel({ card, accounts, categories, onChanged }: PanelProps) {
  const [panel, setPanel] = useState<'none' | 'purchase' | 'invoices'>('none')

  return (
    <div className={styles.subsection}>
      <div className={styles.sectionHead}>
        <span className={styles.rowMain}>
          <strong>{card.name}</strong>
          <span className={styles.rowSub}>
            Fecha dia {card.closingDay} · vence dia {card.dueDay}
          </span>
        </span>
        <span className={styles.rowEnd}>
          <span className={styles.rowSub}>
            Usado {formatMoney(card.usedLimit)} · disponível {formatMoney(card.availableLimit)}
          </span>
          <Button variant="secondary" className={styles.compact} onClick={() => setPanel(panel === 'purchase' ? 'none' : 'purchase')}>
            Nova compra
          </Button>
          <Button variant="secondary" className={styles.compact} onClick={() => setPanel(panel === 'invoices' ? 'none' : 'invoices')}>
            Faturas
          </Button>
        </span>
      </div>
      {panel === 'purchase' ? (
        <PurchaseForm
          card={card}
          categories={categories}
          onSaved={() => {
            setPanel('none')
            onChanged()
          }}
        />
      ) : null}
      {panel === 'invoices' ? <Invoices card={card} accounts={accounts} onPaid={onChanged} /> : null}
    </div>
  )
}

function PurchaseForm({ card, categories, onSaved }: { card: Card; categories: Category[]; onSaved: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayInput)
  const [installments, setInstallments] = useState('1')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!Number.isFinite(value) || value <= 0) {
      action.setError('Informe um valor maior que zero.')
      return
    }
    const saved = await action.run(() =>
      cardsApi.purchase(card.id, {
        amount: value,
        purchasedAt: dateToApi(date),
        installments: Math.max(1, Number(installments) || 1),
        categoryId,
        description: description.trim(),
      }),
    )
    if (saved) {
      onSaved()
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <Field label="Valor (R$)" name={`purchaseAmount-${card.id}`} inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Field label="Data da compra" name={`purchaseDate-${card.id}`} type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      <Field label="Parcelas" name={`purchaseInstallments-${card.id}`} type="number" min={1} max={60} value={installments} onChange={(event) => setInstallments(event.target.value)} />
      <Select label="Categoria" name={`purchaseCategory-${card.id}`} required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        <option value="">Selecione</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <div className={styles.formWide}>
        <Field label="Descrição" name={`purchaseDescription-${card.id}`} required value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className={styles.formWide}>
        <ErrorText message={action.error} />
      </div>
      <div className={styles.formActions}>
        <Button type="submit" disabled={action.busy}>
          Registrar compra
        </Button>
      </div>
    </form>
  )
}

function Invoices({ card, accounts, onPaid }: { card: Card; accounts: Account[]; onPaid: () => void }) {
  const invoices = useLoad(() => cardsApi.invoices(card.id), [card.id])
  const [accountId, setAccountId] = useState(card.paymentAccountId ?? '')
  const action = useAction()
  const current = currentCompetence()

  async function pay(competenceYm: string) {
    if (await action.run(() => cardsApi.payInvoice(card.id, competenceYm, accountId || undefined))) {
      invoices.reload()
      onPaid()
    }
  }

  return (
    <div className={styles.subsection}>
      <Select label="Pagar com a conta" name={`payAccount-${card.id}`} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
        <option value="">Conta padrão do cartão</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </Select>
      <ErrorText message={invoices.error ?? action.error} />
      {invoices.loading && !invoices.data ? <Loading /> : null}
      {invoices.data && invoices.data.length === 0 ? <Empty>Sem faturas ainda.</Empty> : null}
      <ul className={styles.list}>
        {invoices.data?.map((invoice) => (
          <li key={invoice.competenceYm} className={styles.row}>
            <span className={styles.rowMain}>
              <strong>
                Fatura {invoice.competenceYm}
                {invoice.competenceYm === current ? ' (atual)' : ''}
              </strong>
              <span className={styles.rowSub}>
                Fecha {formatDate(invoice.closingDate)} · vence {formatDate(invoice.dueDate)}
              </span>
            </span>
            <span className={styles.rowEnd}>
              <Badge tone={invoice.status === 'Paid' ? 'ok' : invoice.status === 'Closed' ? 'warning' : 'info'}>
                {INVOICE_LABEL[invoice.status]}
              </Badge>
              <span className={styles.amount}>{formatMoney(invoice.total)}</span>
              {invoice.status !== 'Paid' ? (
                <Button variant="secondary" className={styles.compact} disabled={action.busy} onClick={() => void pay(invoice.competenceYm)}>
                  Pagar fatura
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
