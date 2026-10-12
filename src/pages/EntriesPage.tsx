import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  entriesApi,
  receiptsApi,
  type Category,
  type Entry,
  type EntryInput,
  type EntryType,
  type EntryUpdateInput,
  type ReceiptIntake,
} from '../api/finance'
import { ReceiptClassifyDialog } from '../components/ReceiptClassifyDialog'
import { CASH_FLOW_SECTIONS, isCashFlowSection } from '../lib/categoryOrder'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { CategorySelect } from '../components/CategorySelect'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { useRegisterDirty, useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { scanReceipt } from '../camera/scanReceipt'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import {
  currentCompetence,
  dateToApi,
  formatDate,
  formatMoney,
  formatMoneyInput,
  parseMoney,
  todayInput,
} from '../lib/format'
import { isNativeApp } from '../lib/platform'
import { peekPendingShare, takePendingShare } from '../share/pendingShare'
import {
  peekPendingIntakeId,
  pollReceipt,
  setPendingIntakeId,
  takePendingIntakeId,
  uploadPendingShare,
} from '../lib/receiptFlow'
import styles from './page.module.css'

type ReceiptPrefill = {
  description: string
  amount: string
  date: string
  categoryId: string
  accountId: string
}

type FormType = Extract<EntryType, 'Expense' | 'Income' | 'Transfer'>

const TYPE_LABEL: Record<EntryType, string> = {
  Expense: 'Despesa',
  Income: 'Renda',
  Transfer: 'Transferência',
  Contribution: 'Aporte',
  CardPayment: 'Pagamento de fatura',
  ProjectContribution: 'Aporte em projeto',
}

const FORM_TYPES: FormType[] = ['Expense', 'Income', 'Transfer']

function isEditableType(type: EntryType): type is FormType {
  return type === 'Expense' || type === 'Income' || type === 'Transfer'
}

function amountClass(type: EntryType): string | undefined {
  if (type === 'Income') {
    return styles.positive
  }
  return type === 'Transfer' ? undefined : styles.negative
}

function toDateInput(iso: string): string {
  return iso.slice(0, 10)
}

export function EntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { confirmLeave, isDirty } = useUnsavedChanges()
  const [ym, setYm] = useState(currentCompetence)
  const [typeFilter, setTypeFilter] = useState<EntryType | ''>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [classifyOpen, setClassifyOpen] = useState(false)
  const [receiptIntake, setReceiptIntake] = useState<ReceiptIntake | null>(null)
  const [receiptPrefill, setReceiptPrefill] = useState<ReceiptPrefill | null>(null)
  const [receiptIntakeId, setReceiptIntakeId] = useState<string | null>(null)

  useRegisterDirty('entries-form', showForm && formDirty)

  function applyIntakeToForm(intake: ReceiptIntake) {
    setReceiptIntake(intake)
    setReceiptIntakeId(intake.id)
    setPendingIntakeId(intake.id)
    setReceiptPrefill({
      description: intake.extractedName ?? 'Recibo',
      amount: intake.extractedAmount != null ? formatMoneyInput(intake.extractedAmount) : '',
      date: intake.extractedOccurredAt ? toDateInput(intake.extractedOccurredAt) : todayInput(),
      categoryId: intake.proposedCategoryId ?? '',
      accountId: intake.selectedBankAccountId ?? '',
    })
    setEditing(null)
    setShowForm(true)
    setFormDirty(false)
  }

  async function bootstrapReceipt(channel: 'App' | 'ShareTarget' = 'App') {
    if (receiptBusy) return
    setReceiptBusy(true)
    setOpenError(null)
    try {
      let intakeId = peekPendingIntakeId()
      if (!intakeId) {
        const share = peekPendingShare()
        if (!share) {
          return
        }
        const created = await uploadPendingShare(share, channel)
        intakeId = created.id
      }
      const intake = await pollReceipt(intakeId)
      if (intake.status === 'Failed') {
        setOpenError(intake.failureReason ?? 'Não foi possível ler o recibo.')
        return
      }
      if (intake.needsClassification || intake.status === 'NeedsClassification') {
        setReceiptIntake(intake)
        setClassifyOpen(true)
        setShowForm(true)
        return
      }
      applyIntakeToForm(intake)
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'Falha ao processar o recibo.')
    } finally {
      setReceiptBusy(false)
    }
  }

  async function changeYm(next: string) {
    if (next === ym) {
      return
    }
    if (isDirty && !(await confirmLeave())) {
      return
    }
    setYm(next)
  }

  async function closeForm() {
    if (formDirty && !(await confirmLeave())) {
      return
    }
    setShowForm(false)
    setEditing(null)
    setFormDirty(false)
    setOpenError(null)
  }

  async function openCreate() {
    if (showForm && formDirty && !(await confirmLeave())) {
      return
    }
    setEditing(null)
    setOpenError(null)
    setFormDirty(false)
    setShowForm(true)
  }

  async function openEdit(entry: Entry) {
    if (!isEditableType(entry.type)) {
      return
    }
    if (showForm && formDirty && !(await confirmLeave())) {
      return
    }
    setEditing(entry)
    setOpenError(null)
    setFormDirty(false)
    setShowForm(true)
    if (entry.competenceYm) {
      setYm(entry.competenceYm)
    }
  }

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    const isRecibo = searchParams.get('recibo') === '1'

    if (searchParams.get('novo') === '1') {
      setEditing(null)
      setShowForm(true)
      next.delete('novo')
      changed = true
    }

    if (isRecibo) {
      next.delete('recibo')
      changed = true
      void bootstrapReceipt(searchParams.get('canal') === 'share' ? 'ShareTarget' : 'App')
    }

    const competenceYm = searchParams.get('competenceYm')
    if (competenceYm) {
      setYm(competenceYm)
      next.delete('competenceYm')
      changed = true
    }

    const categoryId = searchParams.get('categoryId')
    if (categoryId) {
      setCategoryFilter(categoryId)
      next.delete('categoryId')
      changed = true
    }

    const searchQuery = searchParams.get('search')
    if (searchQuery != null && searchQuery !== '') {
      setSearch(searchQuery)
      setAppliedSearch(searchQuery.trim())
      next.delete('search')
      changed = true
    }

    const entryId = searchParams.get('entry')
    if (entryId) {
      next.delete('entry')
      changed = true
      void entriesApi
        .get(entryId)
        .then((entry) => {
          if (!isEditableType(entry.type)) {
            setOpenError('Este tipo de lançamento não pode ser editado por aqui.')
            return
          }
          setEditing(entry)
          setYm(entry.competenceYm)
          setShowForm(true)
          setFormDirty(false)
        })
        .catch(() => {
          setOpenError('Lançamento não encontrado.')
        })
    }

    if (changed) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once per URL flag
  }, [searchParams, setSearchParams])

  const lookups = useLookups()
  const filterAccountOptions = useMemo(() => {
    const tree = lookups.categories
    const heads = tree.filter(
      (account) =>
        account.level !== 'Analytical' &&
        (account.section === 'Budget' ||
          account.section === 'Expense' ||
          CASH_FLOW_SECTIONS.includes(account.section)),
    )
    const byId = new Map<string, Category>()
    for (const account of [...heads, ...lookups.cashFlowAccounts]) {
      byId.set(account.id, account)
    }
    return [...byId.values()]
  }, [lookups.categories, lookups.cashFlowAccounts])
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

  useEffect(() => {
    if (isNativeApp()) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Insert' || event.ctrlKey || event.altKey || event.metaKey) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && (target.closest('input, textarea, select, [contenteditable="true"]'))) {
        return
      }
      event.preventDefault()
      void openCreate()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showForm, formDirty])

  async function remove(entry: Entry) {
    if (!(await confirmDestructive(`Excluir "${entry.description}"?`, { title: 'Excluir lançamento' }))) {
      return
    }
    if (await rowAction.run(() => entriesApi.remove(entry.id))) {
      if (editing?.id === entry.id) {
        setShowForm(false)
        setEditing(null)
        setFormDirty(false)
      }
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
            <CompetencePicker value={ym} onChange={(next) => void changeYm(next)} />
            <Button
              onClick={() => {
                if (showForm) {
                  void closeForm()
                } else {
                  void openCreate()
                }
              }}
            >
              {showForm ? 'Fechar' : '+ Novo lançamento'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void scanReceipt()
                  .then(() => void openCreate())
                  .catch(() => undefined)
              }}
            >
              Escanear recibo
            </Button>
          </>
        }
      />

      {receiptBusy ? <p className={styles.muted}>Lendo o recibo…</p> : null}
      <ErrorText message={openError} />

      {showForm ? (
        <EntryForm
          key={editing?.id ?? receiptIntakeId ?? 'new'}
          initial={editing}
          receiptPrefill={editing ? null : receiptPrefill}
          receiptIntakeId={editing ? null : receiptIntakeId}
          accounts={lookups.accounts.map((account) => ({ id: account.id, name: account.name }))}
          categories={lookups.cashFlowAccounts}
          tree={lookups.categories}
          onDirtyChange={setFormDirty}
          onCancel={() => void closeForm()}
          onSaved={() => {
            setFormDirty(false)
            setShowForm(false)
            setEditing(null)
            setReceiptPrefill(null)
            setReceiptIntakeId(null)
            takePendingIntakeId()
            takePendingShare()
            entries.reload()
            lookups.reloadAccounts()
          }}
        />
      ) : null}

      <ReceiptClassifyDialog
        open={classifyOpen}
        intake={receiptIntake}
        onClose={() => setClassifyOpen(false)}
        onClassified={(intake) => {
          setClassifyOpen(false)
          applyIntakeToForm(intake)
        }}
      />

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
          <CategorySelect
            label="Conta"
            name="categoryFilter"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={filterAccountOptions}
            tree={lookups.categories}
            emptyLabel="Todas"
          />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>

        <ErrorText message={entries.error ?? rowAction.error ?? openError} />
        {entries.loading && !entries.data ? <Loading /> : null}
        {entries.data && entries.data.items.length === 0 ? <Empty>Nenhum lançamento nesta competência.</Empty> : null}
        {entries.data && entries.data.items.length > 0 ? (
          <ul className={styles.list}>
            {entries.data.items.map((entry) => {
              const editable = isEditableType(entry.type)
              return (
                <li key={entry.id} className={styles.row}>
                  <button
                    type="button"
                    className={styles.rowMain}
                    disabled={!editable}
                    onClick={() => void openEdit(entry)}
                    style={editable ? undefined : { cursor: 'default', textAlign: 'left' }}
                  >
                    <strong>
                      {entry.description}
                      {entry.installmentCount ? ` (${entry.installmentNumber}/${entry.installmentCount})` : ''}
                    </strong>
                    <span className={styles.rowSub}>{describe(entry)}</span>
                  </button>
                  <span className={styles.rowEnd}>
                    <Badge>{TYPE_LABEL[entry.type]}</Badge>
                    <span className={`${styles.amount} ${amountClass(entry.type) ?? ''}`}>
                      {entry.type === 'Expense' ? '− ' : ''}
                      {formatMoney(entry.amount)}
                    </span>
                    <DeleteIconButton disabled={rowAction.busy} onClick={() => void remove(entry)} />
                  </span>
                </li>
              )
            })}
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
  initial: Entry | null
  receiptPrefill?: ReceiptPrefill | null
  receiptIntakeId?: string | null
  accounts: { id: string; name: string }[]
  categories: Category[]
  tree: Category[]
  onDirtyChange?: (dirty: boolean) => void
  onCancel: () => void
  onSaved: () => void
}

function matchesEntryType(section: string, type: FormType): boolean {
  if (type === 'Income') {
    return section === 'Income'
  }
  if (type === 'Transfer') {
    return false
  }
  return isCashFlowSection(section as Category['section']) && section !== 'Income'
}

function EntryForm({
  initial,
  receiptPrefill,
  receiptIntakeId,
  accounts,
  categories,
  tree,
  onDirtyChange,
  onCancel,
  onSaved,
}: FormProps) {
  const editing = initial !== null
  const [type, setType] = useState<FormType>(() =>
    initial && isEditableType(initial.type) ? initial.type : 'Expense',
  )
  const [amount, setAmount] = useState(() =>
    initial ? formatMoneyInput(initial.amount) : (receiptPrefill?.amount ?? ''),
  )
  const [date, setDate] = useState(() =>
    initial ? toDateInput(initial.occurredAt) : (receiptPrefill?.date ?? todayInput()),
  )
  const pendingReceipt = !editing ? peekPendingShare() : null
  const [description, setDescription] = useState(() =>
    initial
      ? initial.description
      : (receiptPrefill?.description ??
        (pendingReceipt ? pendingReceipt.fileName.replace(/\.[^.]+$/, '') : '')),
  )
  const [receiptPreview] = useState(pendingReceipt?.dataUrl ?? '')
  const [accountId, setAccountId] = useState(
    () => initial?.accountId ?? receiptPrefill?.accountId ?? '',
  )
  const [contraAccountId, setContraAccountId] = useState(() => initial?.contraAccountId ?? '')
  const [categoryId, setCategoryId] = useState(
    () => initial?.categoryId ?? receiptPrefill?.categoryId ?? '',
  )
  const action = useAction()

  const baseline = {
    type: (initial && isEditableType(initial.type) ? initial.type : 'Expense') as FormType,
    amount: initial ? formatMoneyInput(initial.amount) : (receiptPrefill?.amount ?? ''),
    date: initial ? toDateInput(initial.occurredAt) : (receiptPrefill?.date ?? todayInput()),
    description: initial
      ? initial.description
      : (receiptPrefill?.description ??
        (pendingReceipt ? pendingReceipt.fileName.replace(/\.[^.]+$/, '') : '')),
    accountId: initial?.accountId ?? receiptPrefill?.accountId ?? '',
    contraAccountId: initial?.contraAccountId ?? '',
    categoryId: initial?.categoryId ?? receiptPrefill?.categoryId ?? '',
  }

  const kindCategories = categories.filter((category) => matchesEntryType(category.section, type))

  useEffect(() => {
    const dirty =
      type !== baseline.type ||
      amount !== baseline.amount ||
      date !== baseline.date ||
      description !== baseline.description ||
      accountId !== baseline.accountId ||
      contraAccountId !== baseline.contraAccountId ||
      categoryId !== baseline.categoryId
    onDirtyChange?.(dirty)
  }, [
    type,
    amount,
    date,
    description,
    accountId,
    contraAccountId,
    categoryId,
    baseline.type,
    baseline.amount,
    baseline.date,
    baseline.description,
    baseline.accountId,
    baseline.contraAccountId,
    baseline.categoryId,
    onDirtyChange,
  ])

  async function suggest() {
    if (editing || type === 'Transfer' || categoryId || description.trim().length < 3) {
      return
    }
    try {
      const suggestion = await entriesApi.suggestAccount(description.trim())
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

    if (editing && initial) {
      const input: EntryUpdateInput = {
        amount: value,
        occurredAt: dateToApi(date),
        description: description.trim(),
        accountId: accountId || undefined,
        contraAccountId: type === 'Transfer' ? contraAccountId || undefined : undefined,
        categoryId: type === 'Transfer' ? undefined : categoryId || undefined,
        incomeSourceId: type === 'Income' ? initial.incomeSourceId ?? undefined : undefined,
        memberId: initial.memberId ?? undefined,
        confirmDuplicate,
      }
      if (await action.run(() => entriesApi.update(initial.id, input))) {
        showSaveToast('Lançamento salvo.')
        onSaved()
      }
      return
    }

    if (receiptIntakeId && type === 'Expense') {
      if (
        await action.run(() =>
          receiptsApi.confirm(receiptIntakeId, {
            amount: value,
            occurredAt: dateToApi(date),
            description: description.trim(),
            accountId: accountId || undefined,
            categoryId: categoryId || undefined,
            confirmDuplicate,
          }),
        )
      ) {
        showSaveToast('Lançamento salvo.')
        onSaved()
      }
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
      confirmDuplicate,
    }

    if (await action.run(() => entriesApi.create(input))) {
      showSaveToast('Lançamento salvo.')
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
      <h2 className={styles.sectionTitle}>{editing ? 'Editar lançamento' : 'Novo lançamento'}</h2>
      <div className={styles.segmented} role="group" aria-label="Tipo de lançamento">
        {FORM_TYPES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={type === option}
            disabled={editing}
            onClick={() => {
              if (editing) {
                return
              }
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
        <Select label={type === 'Transfer' ? 'Conta de origem' : 'Conta bancária'} name="accountId" required value={accountId} onChange={(event) => setAccountId(event.target.value)}>
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
          <CategorySelect
            label="Conta"
            name="categoryId"
            value={categoryId}
            onChange={setCategoryId}
            options={kindCategories}
            tree={tree}
            emptyLabel="Sem conta"
          />
        )}
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Salvar
          </Button>
          <Button type="button" variant="secondary" disabled={action.busy} onClick={onCancel}>
            Cancelar
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
