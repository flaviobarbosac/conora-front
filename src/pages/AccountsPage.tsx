import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
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
import { Pager } from '../components/Pager'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { IntegerField } from '../components/ui/IntegerField'
import { MoneyField } from '../components/ui/MoneyField'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useClientPagination } from '../hooks/useClientPagination'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { confirmDestructive } from '../lib/confirm'
import { currentCompetence, dateToApi, formatDate, formatMoney, parseMoney, todayInput } from '../lib/format'
import styles from './page.module.css'

const KIND_LABEL: Record<AccountKind, string> = {
  Checking: 'Conta corrente',
  Savings: 'Conta poupança',
  Investment: 'Conta investimento',
  Cash: 'Dinheiro',
  Other: 'Outra',
}

const ACCOUNT_KIND_OPTIONS: AccountKind[] = ['Checking', 'Savings', 'Investment']

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  Open: 'Aberta',
  Closed: 'Fechada',
  Paid: 'Paga',
}

type AccountsView = 'accounts' | 'cards'

function viewFromPath(pathname: string): AccountsView {
  if (pathname === '/cartoes' || pathname.startsWith('/cartoes/')) {
    return 'cards'
  }
  return 'accounts'
}

export function AccountsPage() {
  const { pathname } = useLocation()
  const view = viewFromPath(pathname)
  const showAccounts = view === 'accounts'
  const showCards = view === 'cards'

  const lookups = useLookups()
  const accounts = useLoad(() => accountsApi.list(true), [])
  const cards = useLoad(() => cardsApi.list(), [])
  const archive = useAction()

  function refresh() {
    accounts.reload()
    lookups.reloadAccounts()
  }

  async function toggleArchive(account: Account) {
    const message = account.isArchived
      ? `Reativar a conta "${account.name}"?`
      : `Arquivar a conta "${account.name}"?`
    if (!(await confirmDestructive(message, { title: account.isArchived ? 'Reativar conta' : 'Arquivar conta', confirmLabel: account.isArchived ? 'Reativar' : 'Arquivar' }))) {
      return
    }
    if (await archive.run(() => accountsApi.archive(account.id, !account.isArchived))) {
      refresh()
    }
  }

  const activeAccounts = (accounts.data ?? []).filter((account) => !account.isArchived)
  const accountList = accounts.data ?? []
  const cardList = cards.data ?? []
  const accountsPage = useClientPagination(accountList, 10)
  const cardsPage = useClientPagination(cardList, 10)

  const pageTitle = showCards ? 'Cartões' : 'Contas'
  const pageKicker = showCards ? 'Crédito' : 'Dinheiro'

  return (
    <div className={styles.page}>
      <PageHeader kicker={pageKicker} title={pageTitle} />

      {showAccounts ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Contas</h2>
            <ErrorText message={accounts.error ?? archive.error} />
            {accounts.loading && !accounts.data ? <Loading /> : null}
            {accounts.data && accounts.data.length === 0 ? <Empty>Nenhuma conta cadastrada.</Empty> : null}
            {accounts.data && accounts.data.length > 0 ? (
              <>
                <ul className={styles.list}>
                  {accountsPage.pageItems.map((account) => (
                    <li key={account.id} className={styles.row}>
                      <span className={styles.rowMain}>
                        <strong>{account.name}</strong>
                        <span className={styles.rowSub}>
                          {KIND_LABEL[account.kind]}
                          {account.bankCode
                            ? ` · ${account.bankCode}${account.bankName ? ` ${account.bankName}` : ''}`
                            : ''}
                          {account.agency ? ` · Ag ${account.agency}` : ''}
                          {account.accountNumber
                            ? ` · Conta ${account.accountNumber}${account.checkDigit ? `-${account.checkDigit}` : ''}`
                            : ''}
                        </span>
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
                <Pager
                  page={accountsPage.page}
                  pageCount={accountsPage.pageCount}
                  total={accountsPage.total}
                  pageSize={accountsPage.pageSize}
                  onPageChange={accountsPage.setPage}
                />
              </>
            ) : null}
          </section>

          <div className={styles.grid2}>
            <AccountForm onSaved={refresh} />
            <TransferForm accounts={activeAccounts} onSaved={refresh} />
          </div>
        </>
      ) : null}

      {showCards ? (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Cartões de crédito</h2>
            <ErrorText message={cards.error} />
            {cards.loading && !cards.data ? <Loading /> : null}
            {cards.data && cards.data.length === 0 ? <Empty>Nenhum cartão cadastrado.</Empty> : null}
            {cardsPage.pageItems.map((card) => (
              <CardPanel
                key={card.id}
                card={card}
                accounts={activeAccounts}
                categories={lookups.expenseAccounts}
                onChanged={() => {
                  cards.reload()
                  refresh()
                }}
              />
            ))}
            <Pager
              page={cardsPage.page}
              pageCount={cardsPage.pageCount}
              total={cardsPage.total}
              pageSize={cardsPage.pageSize}
              onPageChange={cardsPage.setPage}
            />
          </section>

          <CardForm accounts={activeAccounts} onSaved={cards.reload} />
        </>
      ) : null}
    </div>
  )
}

function AccountForm({ onSaved }: { onSaved: () => void }) {
  const banks = useLoad(() => accountsApi.banks(), [])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('Checking')
  const [bankCode, setBankCode] = useState('021')
  const [agency, setAgency] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [checkDigit, setCheckDigit] = useState('')
  const [balance, setBalance] = useState('')
  const action = useAction()
  const needsBank = kind !== 'Cash'

  async function submit(event: FormEvent) {
    event.preventDefault()
    const opening = balance.trim() ? parseMoney(balance) : 0
    if (!Number.isFinite(opening)) {
      action.setError('Saldo inicial inválido.')
      return
    }
    if (
      await action.run(() =>
        accountsApi.create({
          name: name.trim(),
          kind,
          openingBalance: opening,
          bankCode: needsBank ? bankCode || undefined : undefined,
          agency: needsBank ? agency.trim() || undefined : undefined,
          accountNumber: needsBank ? accountNumber.trim() || undefined : undefined,
          checkDigit: needsBank ? checkDigit.trim() || undefined : undefined,
        }),
      )
    ) {
      setName('')
      setKind('Checking')
      setBankCode('021')
      setAgency('')
      setAccountNumber('')
      setCheckDigit('')
      setBalance('')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Nova conta</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
          <Field
            label="Descrição"
            name="accountName"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Nome para identificar a conta no app."
          />
        </div>
        <Select label="Tipo de conta" name="accountKind" value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
          {ACCOUNT_KIND_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {KIND_LABEL[option]}
            </option>
          ))}
        </Select>
        {needsBank ? (
          <>
            <Select
              label="Banco"
              name="bankCode"
              required
              value={bankCode}
              onChange={(event) => setBankCode(event.target.value)}
            >
              <option value="">Selecione</option>
              {(banks.data ?? []).map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.code} — {bank.name}
                </option>
              ))}
            </Select>
            <Field
              label="Agência"
              name="agency"
              required
              value={agency}
              onChange={(event) => setAgency(event.target.value.replace(/[^\d-]/g, ''))}
            />
            <Field
              label="Número da conta"
              name="accountNumber"
              required
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value.replace(/[^\d]/g, ''))}
            />
            <IntegerField
              label="Dígito verificador"
              name="checkDigit"
              required
              maxLength={2}
              value={checkDigit}
              onChange={setCheckDigit}
            />
          </>
        ) : null}
        <MoneyField label="Saldo inicial (R$)" name="openingBalance" value={balance} onChange={setBalance} />
        <div className={styles.formWide}>
          <ErrorText message={action.error ?? banks.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy || (needsBank && banks.loading)}>
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
        <MoneyField label="Valor (R$)" name="transferAmount" required value={amount} onChange={setAmount} />
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
        <MoneyField label="Limite (R$)" name="cardLimit" required value={limit} onChange={setLimit} />
        <IntegerField label="Dia de fechamento" name="closingDay" required maxLength={2} value={closing} onChange={setClosing} />
        <IntegerField label="Dia de vencimento" name="dueDay" required maxLength={2} value={due} onChange={setDue} />
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
  const [chartAccountId, setChartAccountId] = useState('')
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
        chartAccountId,
        description: description.trim(),
      }),
    )
    if (saved) {
      onSaved()
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <MoneyField label="Valor (R$)" name={`purchaseAmount-${card.id}`} required value={amount} onChange={setAmount} />
      <Field label="Data da compra" name={`purchaseDate-${card.id}`} type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      <IntegerField
        label="Parcelas"
        name={`purchaseInstallments-${card.id}`}
        maxLength={2}
        value={installments}
        onChange={setInstallments}
      />
      <Select label="Conta" name={`purchaseAccount-${card.id}`} required value={chartAccountId} onChange={(event) => setChartAccountId(event.target.value)}>
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
