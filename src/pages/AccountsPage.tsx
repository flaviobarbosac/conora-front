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
import { AccountForm } from '../components/finance/AccountForm'
import { CardForm } from '../components/finance/CardForm'
import { CategorySelect } from '../components/CategorySelect'
import { PageHeader } from '../components/PageHeader'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { hasFullAccess } from '../lib/freeTier'
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
import { showSaveToast } from '../lib/saveToast'
import { currentCompetence, dateToApi, formatDate, formatMoney, parseMoney, todayInput } from '../lib/format'
import styles from './pageStyles'

const KIND_LABEL: Record<AccountKind, string> = {
  Checking: 'Conta corrente',
  Savings: 'Conta poupança',
  Investment: 'Conta investimento',
  Cash: 'Dinheiro',
  Other: 'Outra',
}

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
  const { plan } = usePlanAccess()
  const fullAccess = hasFullAccess(plan)
  const [editing, setEditing] = useState<Account | null>(null)

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
      showSaveToast(account.isArchived ? 'Conta reativada.' : 'Conta arquivada.')
      refresh()
    }
  }

  const activeAccounts = (accounts.data ?? []).filter((account) => !account.isArchived)
  const accountList = accounts.data ?? []
  const cardList = cards.data ?? []
  const accountsPage = useClientPagination(accountList, 10)
  const cardsPage = useClientPagination(cardList, 10)
  const canAddAccount = fullAccess || activeAccounts.length < 1

  const pageTitle = showCards ? 'Cartões' : 'Contas'

  return (
    <div className={styles.page}>
      <PageHeader title={pageTitle} />

      {showAccounts ? (
        <>
          <section className={styles.section} aria-label="Contas bancárias">
            {!fullAccess && accountList.length === 0 ? (
              <p className={styles.muted}>
                No Conora grátis você cadastra uma conta bancária para os lançamentos.
              </p>
            ) : null}
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
                        </span>
                        {account.agency || account.accountNumber ? (
                          <span className={styles.rowSub}>
                            {account.agency ? `Ag ${account.agency}` : null}
                            {account.agency && account.accountNumber ? ' · ' : null}
                            {account.accountNumber
                              ? `Conta ${account.accountNumber}${account.checkDigit ? `-${account.checkDigit}` : ''}`
                              : null}
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.rowEnd}>
                        {account.isArchived ? <Badge tone="warning">Arquivada</Badge> : null}
                        <span className={styles.amount} aria-label="Saldo atual">
                          {formatMoney(account.balance)}
                        </span>
                        <Button
                          variant="secondary"
                          disabled={archive.busy}
                          aria-label={`Editar ${account.name}`}
                          onClick={() => setEditing(account)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={archive.busy}
                          aria-label={
                            account.isArchived ? `Reativar ${account.name}` : `Arquivar ${account.name}`
                          }
                          onClick={() => void toggleArchive(account)}
                        >
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

          {editing ? (
            <AccountForm
              key={editing.id}
              initial={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null)
                refresh()
              }}
            />
          ) : canAddAccount ? (
            <AccountForm onSaved={refresh} />
          ) : !fullAccess ? (
            <p className={styles.muted}>No plano grátis só uma conta bancária.</p>
          ) : null}
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
                tree={lookups.categories}
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

type PanelProps = {
  card: Card
  accounts: Account[]
  categories: Category[]
  tree: Category[]
  onChanged: () => void
}

function CardPanel({ card, accounts, categories, tree, onChanged }: PanelProps) {
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
          <Button
            variant="secondary"
            className={styles.compact}
            onClick={() => setPanel(panel === 'purchase' ? 'none' : 'purchase')}
          >
            Nova compra
          </Button>
          <Button
            variant="secondary"
            className={styles.compact}
            onClick={() => setPanel(panel === 'invoices' ? 'none' : 'invoices')}
          >
            Faturas
          </Button>
        </span>
      </div>
      {panel === 'purchase' ? (
        <PurchaseForm
          card={card}
          categories={categories}
          tree={tree}
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

function PurchaseForm({
  card,
  categories,
  tree,
  onSaved,
}: {
  card: Card
  categories: Category[]
  tree: Category[]
  onSaved: () => void
}) {
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
      showSaveToast('Compra registrada.')
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
      <CategorySelect
        label="Conta"
        name={`purchaseAccount-${card.id}`}
        required
        value={categoryId}
        onChange={setCategoryId}
        options={categories}
        tree={tree}
        emptyLabel="Selecione"
      />
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
      showSaveToast('Fatura paga.')
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
