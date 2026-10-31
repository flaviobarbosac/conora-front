import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  entriesApi,
  entryDisplayDescription,
  monthsApi,
  receiptsApi,
  type Category,
  type Entry,
  type EntryInput,
  type EntryType,
  type EntryUpdateInput,
  type ReceiptIntake,
} from '../api/finance'
import { ReceiptClassifyDialog } from '../components/ReceiptClassifyDialog'
import {
  ReceiptReadingOverlay,
  WordLancamento,
  WordOrcamento,
} from '../components/ReceiptReadingOverlay'
import { CASH_FLOW_SECTIONS, isPatrimonySection } from '../lib/categoryOrder'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { Pager } from '../components/Pager'
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
import { FREE_TIER_INCOME_ENTRY_HINT, isCategoryWritable, PAID_MODULE_BADGE } from '../lib/freeTier'
import { isNativeApp } from '../lib/platform'
import { safeRaioXReturnTo } from '../lib/raioXReturn'
import { readSharingView } from '../lib/sharingView'
import { takeVoiceDraft, subscribeVoiceFill } from '../lib/voiceDraft'
import { matchByName, resolveSpokenDate } from '../lib/voiceEntry'
import { peekPendingShare, setPendingShare, takePendingShare } from '../share/pendingShare'
import { usePlanAccess } from '../hooks/usePlanAccess'
import {
  pauseForDestinationCue,
  peekPendingIntakeId,
  pickReceiptMedia,
  pollReceipt,
  setPendingIntakeId,
  setReceiptRerouteHint,
  takePendingIntakeId,
  takeReceiptRerouteHint,
  uploadPendingShare,
} from '../lib/receiptFlow'
import { resetMobileViewport } from '../lib/resetMobileViewport'
import styles from './pageStyles'

type ReceiptPrefill = {
  description: string
  amount: string
  date: string
  categoryId: string
  accountId: string
}

type FormType = Extract<EntryType, 'Expense' | 'Income'>

const TYPE_LABEL: Record<EntryType, string> = {
  Expense: 'Despesa',
  Income: 'Renda',
  Transfer: 'Transferência',
  Contribution: 'Aporte',
  CardPayment: 'Pagamento de fatura',
  ProjectContribution: 'Aporte em projeto',
}

const FORM_TYPES: FormType[] = ['Expense', 'Income']

const CLOSED_MONTH_MESSAGE =
  'Este mês está fechado. Por ora o Conora não permite lançamento retroativo. Reabra o mês em Fechar mês se precisar corrigir.'

const ENTRIES_PAGE_SIZE = 10

function isEditableType(type: EntryType): type is FormType {
  return type === 'Expense' || type === 'Income'
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

type EntriesMode = 'list' | 'novo' | 'edit' | 'busca'

function parseEntriesMode(splat: string | undefined): { mode: EntriesMode; entryId: string | null } {
  const part = (splat ?? '').replace(/^\/+|\/+$/g, '')
  if (!part) {
    return { mode: 'list', entryId: null }
  }
  if (part === 'novo') {
    return { mode: 'novo', entryId: null }
  }
  if (part === 'busca') {
    return { mode: 'busca', entryId: null }
  }
  const edit = /^([^/]+)\/editar$/.exec(part)
  if (edit) {
    return { mode: 'edit', entryId: edit[1] }
  }
  return { mode: 'list', entryId: null }
}

export function EntriesPage() {
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const { mode, entryId: routeEntryId } = parseEntriesMode(splat)
  const showForm = mode === 'novo' || mode === 'edit'
  const [searchParams, setSearchParams] = useSearchParams()
  // Only when Busca was opened from a Raio-X click (returnTo in the URL).
  const returnToRaioX = safeRaioXReturnTo(searchParams.get('returnTo'))
  const { confirmLeave, isDirty } = useUnsavedChanges()

  function goBackToRaioX() {
    if (!returnToRaioX) {
      return
    }
    navigate(returnToRaioX)
  }
  const [ym, setYm] = useState(currentCompetence)
  const [typeFilter, setTypeFilter] = useState<EntryType | ''>('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const [receiptBusy, setReceiptBusy] = useState(false)
  const [readingPurpose, setReadingPurpose] = useState<'Expense' | 'BudgetBoleto'>('Expense')
  const [readingRerouted, setReadingRerouted] = useState(false)
  const [classifyOpen, setClassifyOpen] = useState(false)
  const [classifyRerouteHint, setClassifyRerouteHint] = useState<'to-budget' | 'to-expense' | null>(null)
  const [receiptIntake, setReceiptIntake] = useState<ReceiptIntake | null>(null)
  const [receiptPrefill, setReceiptPrefill] = useState<ReceiptPrefill | null>(null)
  const [receiptIntakeId, setReceiptIntakeId] = useState<string | null>(null)
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null)

  useRegisterDirty('entries-form', showForm && formDirty)

  const monthStatus = useLoad(() => monthsApi.get(ym), [ym])
  const monthClosed = Boolean(monthStatus.data?.isClosed)
  const closedMonthMessage = monthStatus.data?.isClosed
    ? `O mês ${ym} está fechado. Por ora o Conora não permite lançamento retroativo. Reabra o mês em Fechar mês se precisar corrigir.`
    : CLOSED_MONTH_MESSAGE

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
    setFormDirty(false)
    navigate('/lancamentos/novo')
  }

  async function bootstrapReceipt(channel: 'App' | 'ShareTarget' = 'App') {
    if (receiptBusy) return
    setReceiptBusy(true)
    setReadingPurpose('Expense')
    setReadingRerouted(false)
    setOpenError(null)
    resetMobileViewport()
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
      setReadingPurpose(intake.purpose)
      if (intake.purpose === 'BudgetBoleto') {
        setReadingRerouted(true)
        setPendingIntakeId(intake.id)
        setReceiptRerouteHint('to-budget')
        takePendingShare()
        await pauseForDestinationCue()
        navigate('/orcamento?recibo=1', { replace: true })
        return
      }
      if (intake.status === 'Failed') {
        setOpenError(intake.failureReason ?? 'Não foi possível ler o recibo.')
        takePendingIntakeId()
        return
      }
      if (intake.status === 'Confirmed') {
        takePendingIntakeId()
        showSaveToast('Lançamento gravado.')
        navigate('/lancamentos')
        entries.reload()
        return
      }
      if (intake.needsClassification || intake.status === 'NeedsClassification') {
        setClassifyRerouteHint(takeReceiptRerouteHint())
        setReceiptIntake(intake)
        setClassifyOpen(true)
        navigate('/lancamentos')
        return
      }
      if (intake.status === 'Ready' && intake.proposedCategoryId) {
        await receiptsApi.confirm(intake.id, {
          categoryId: intake.proposedCategoryId,
          accountId: intake.selectedBankAccountId ?? undefined,
          amount: intake.extractedAmount ?? undefined,
          occurredAt: intake.extractedOccurredAt ?? undefined,
          description: intake.extractedName ?? undefined,
        })
        takePendingIntakeId()
        showSaveToast('Lançamento gravado.')
        navigate('/lancamentos')
        entries.reload()
        return
      }
      applyIntakeToForm(intake)
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'Falha ao processar o recibo.')
    } finally {
      setReceiptBusy(false)
      setReadingRerouted(false)
      resetMobileViewport()
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
    setEditing(null)
    setFormDirty(false)
    setOpenError(null)
    setReceiptPrefill(null)
    setReceiptIntakeId(null)
    goToList()
  }

  async function openCreate() {
    if (monthClosed) {
      setOpenError(closedMonthMessage)
      return
    }
    if (showForm && formDirty && !(await confirmLeave())) {
      return
    }
    setEditing(null)
    setOpenError(null)
    setFormDirty(false)
    navigate('/lancamentos/novo')
  }

  async function openEdit(entry: Entry) {
    if (!isEditableType(entry.type)) {
      return
    }
    if (entry.canEdit === false) {
      setOpenError('Só quem lançou pode editar este lançamento.')
      return
    }
    if (monthClosed) {
      setOpenError(closedMonthMessage)
      return
    }
    if (showForm && formDirty && !(await confirmLeave())) {
      return
    }
    setEditing(entry)
    setOpenError(null)
    setFormDirty(false)
    if (entry.competenceYm) {
      setYm(entry.competenceYm)
    }
    navigate(`/lancamentos/${entry.id}/editar`)
  }

  function goToList() {
    setSearch('')
    setAppliedSearch('')
    setTypeFilter('')
    setCategoryFilter('')
    navigate('/lancamentos')
  }

  function goToSearch() {
    navigate('/lancamentos/busca')
  }

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    let goNovo = false
    let goBusca = false
    let goEditId: string | null = null
    const isRecibo = searchParams.get('recibo') === '1'

    if (searchParams.get('novo') === '1') {
      setEditing(null)
      goNovo = true
      next.delete('novo')
      changed = true
    }

    if (isRecibo) {
      next.delete('recibo')
      changed = true
      goNovo = true
      void bootstrapReceipt(searchParams.get('canal') === 'share' ? 'ShareTarget' : 'App')
    }

    if (searchParams.get('voz') === '1') {
      next.delete('voz')
      changed = true
      goNovo = true
      const draft = takeVoiceDraft()
      if (draft) {
        setReceiptPrefill({
          description: draft.description,
          amount: draft.amount,
          date: todayInput(),
          categoryId: '',
          accountId: '',
        })
        setEditing(null)
        setFormDirty(Boolean(draft.description || draft.amount))
      }
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
      goBusca = true
    }

    const typeQuery = searchParams.get('type')
    if (typeQuery === 'Expense' || typeQuery === 'Income') {
      setTypeFilter(typeQuery)
      next.delete('type')
      changed = true
      goBusca = true
    }

    const searchQuery = searchParams.get('search')
    if (searchQuery != null && searchQuery !== '') {
      setSearch(searchQuery)
      setAppliedSearch(searchQuery.trim())
      next.delete('search')
      changed = true
      goBusca = true
    }

    const entryId = searchParams.get('entry')
    if (entryId) {
      next.delete('entry')
      changed = true
      goEditId = entryId
    }

    if (changed) {
      setSearchParams(next, { replace: true })
    }
    if (goEditId) {
      navigate(`/lancamentos/${goEditId}/editar`, { replace: true })
    } else if (goNovo) {
      navigate('/lancamentos/novo', { replace: true })
    } else if (goBusca && mode === 'list') {
      navigate({ pathname: '/lancamentos/busca', search: next.toString() ? `?${next.toString()}` : '' }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once per URL flag
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (mode !== 'edit' || !routeEntryId) {
      return
    }
    if (editing?.id === routeEntryId) {
      return
    }
    let cancelled = false
    void entriesApi
      .get(routeEntryId)
      .then((entry) => {
        if (cancelled) {
          return
        }
        if (!isEditableType(entry.type)) {
          setOpenError('Este tipo de lançamento não pode ser editado por aqui.')
          navigate('/lancamentos', { replace: true })
          return
        }
        setEditing(entry)
        setYm(entry.competenceYm)
        setFormDirty(false)
      })
      .catch(() => {
        if (!cancelled) {
          setOpenError('Lançamento não encontrado.')
          navigate('/lancamentos', { replace: true })
        }
      })
    return () => {
      cancelled = true
    }
  }, [mode, routeEntryId, editing?.id, navigate])

  useEffect(() => {
    if (mode === 'novo') {
      setEditing(null)
    }
  }, [mode])

  const lookups = useLookups()
  const filterAccountOptions = useMemo(() => {
    const tree = lookups.categories
    const heads = tree.filter(
      (account) =>
        account.level !== 'Analytical' &&
        (account.section === 'Budget' ||
          account.section === 'Expense' ||
          account.section === 'Patrimony' ||
          CASH_FLOW_SECTIONS.includes(account.section) ||
          isPatrimonySection(account.section)),
    )
    const posting = tree.filter(
      (account) =>
        account.level === 'Analytical' &&
        account.isActive &&
        (CASH_FLOW_SECTIONS.includes(account.section) || isPatrimonySection(account.section)),
    )
    const byId = new Map<string, Category>()
    for (const account of [...heads, ...posting]) {
      byId.set(account.id, account)
    }
    return [...byId.values()]
  }, [lookups.categories])
  const sharingScope = readSharingView()

  useEffect(() => {
    setPage(1)
  }, [ym, typeFilter, categoryFilter, appliedSearch, sharingScope])

  const entries = useLoad(
    () =>
      entriesApi.list({
        competenceYm: ym,
        type: typeFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: appliedSearch || undefined,
        skip: (page - 1) * ENTRIES_PAGE_SIZE,
        take: ENTRIES_PAGE_SIZE,
        scope: sharingScope,
      }),
    [ym, typeFilter, categoryFilter, appliedSearch, sharingScope, page],
  )
  const entriesTotal = entries.data?.totalCount ?? 0
  const entriesPageCount = Math.max(1, Math.ceil(entriesTotal / ENTRIES_PAGE_SIZE))
  const rowAction = useAction()

  useEffect(() => {
    if (page > entriesPageCount) {
      setPage(entriesPageCount)
    }
  }, [page, entriesPageCount])

  useEffect(() => {
    return subscribeVoiceFill(() => {
      setEditing(null)
      navigate('/lancamentos/novo')
    })
  }, [navigate])

  useEffect(() => {
    function openForm() {
      setEditing(null)
      navigate('/lancamentos/novo')
    }
    function onSaved(event: Event) {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id ?? ''
      setFormDirty(false)
      setEditing(null)
      navigate('/lancamentos')
      if (id) {
        setSavedEntryId(id)
      }
      entries.reload()
    }
    window.addEventListener('conora:voice-open-form', openForm)
    window.addEventListener('conora:voice-saved', onSaved)
    return () => {
      window.removeEventListener('conora:voice-open-form', openForm)
      window.removeEventListener('conora:voice-saved', onSaved)
    }
  }, [entries, navigate])

  useEffect(() => {
    if (!savedEntryId || !entries.data?.items.some((item) => item.id === savedEntryId)) {
      return
    }
    document.getElementById(`entry-${savedEntryId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    setSavedEntryId(null)
  }, [entries.data, savedEntryId])

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
    if (entry.canEdit === false) {
      setOpenError('Só quem lançou pode excluir este lançamento.')
      return
    }
    if (monthClosed) {
      setOpenError(closedMonthMessage)
      return
    }
    if (!(await confirmDestructive(`Excluir "${entry.description}"?`, { title: 'Excluir lançamento' }))) {
      return
    }
    if (await rowAction.run(() => entriesApi.remove(entry.id))) {
      if (editing?.id === entry.id) {
        setEditing(null)
        setFormDirty(false)
        navigate('/lancamentos')
      }
      entries.reload()
    }
  }

  function describe(entry: Entry): string {
    const account = entry.type === 'Transfer'
      ? `${lookups.accountName(entry.accountId)} → ${lookups.accountName(entry.contraAccountId)}`
      : lookups.accountName(entry.accountId)
    const category = entry.categoryId ? lookups.categoryName(entry.categoryId) : null
    return [category, account, formatDate(entry.occurredAt)].filter(Boolean).join(' · ')
  }

  const pageTitle =
    mode === 'novo'
      ? 'Novo lançamento'
      : mode === 'edit'
        ? 'Editar lançamento'
        : mode === 'busca'
          ? 'Buscar lançamentos'
          : 'Lançamentos'

  const listSection = (
    <section className={styles.section}>
      {mode === 'busca' ? (
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
            label="Categoria"
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
      ) : null}

      <ErrorText message={entries.error ?? rowAction.error ?? openError} />
      {entries.loading && !entries.data ? <Loading /> : null}
      {entries.data && entries.data.items.length === 0 ? <Empty>Nenhum lançamento nesta competência.</Empty> : null}
      {entries.data && entries.data.items.length > 0 ? (
        <ul className={styles.list}>
          {entries.data.items.map((entry) => {
            const editable = isEditableType(entry.type) && !monthClosed && entry.canEdit !== false
            return (
              <li key={entry.id} id={`entry-${entry.id}`} className={styles.row} style={{ scrollMarginTop: 96 }}>
                <button
                  type="button"
                  className={styles.rowMain}
                  disabled={!editable}
                  onClick={() => void openEdit(entry)}
                  style={editable ? undefined : { cursor: 'default', textAlign: 'left' }}
                >
                  <strong>
                    {describe(entry)}
                    {entry.installmentCount ? ` (${entry.installmentNumber}/${entry.installmentCount})` : ''}
                  </strong>
                  <span className={styles.rowSub}>{entryDisplayDescription(entry)}</span>
                </button>
                <span className={styles.rowEnd}>
                  <Badge>{TYPE_LABEL[entry.type]}</Badge>
                  <span className={`${styles.amount} ${amountClass(entry.type) ?? ''}`}>
                    {entry.type === 'Expense' ? '− ' : ''}
                    {formatMoney(entry.amount)}
                  </span>
                  <DeleteIconButton
                    disabled={rowAction.busy || monthClosed || entry.canEdit === false}
                    onClick={() => void remove(entry)}
                  />
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
      <Pager
        page={page}
        pageCount={entriesPageCount}
        total={entriesTotal}
        pageSize={ENTRIES_PAGE_SIZE}
        onPageChange={setPage}
      />
    </section>
  )

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Movimentações"
        title={pageTitle}
        actions={
          <>
            {mode === 'busca' && returnToRaioX ? (
              <Button variant="secondary" onClick={goBackToRaioX}>
                Voltar pro Raio-X
              </Button>
            ) : null}
            {showForm || mode === 'busca' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  if (mode === 'busca') {
                    goToList()
                    return
                  }
                  void closeForm()
                }}
              >
                {mode === 'busca' ? 'Voltar à lista' : 'Voltar à lista'}
              </Button>
            ) : null}
            {!showForm ? (
              <CompetencePicker value={ym} onChange={(next) => void changeYm(next)} />
            ) : null}
            {mode === 'list' ? (
              <>
                <Button disabled={monthClosed} onClick={() => void openCreate()}>
                  + Novo lançamento
                </Button>
                <Button variant="secondary" onClick={goToSearch}>
                  Buscar
                </Button>
                <Button
                  variant="secondary"
                  disabled={monthClosed || receiptBusy}
                  onClick={() => {
                    void (async () => {
                      try {
                        // Same rule as Orçamento: native → camera; web → file picker.
                        if (isNativeApp()) {
                          await scanReceipt()
                        } else {
                          const file = await pickReceiptMedia()
                          const dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader()
                            reader.onload = () => resolve(String(reader.result))
                            reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
                            reader.readAsDataURL(file)
                          })
                          setPendingShare({
                            fileName: file.name || 'recibo.jpg',
                            mimeType: file.type || 'image/jpeg',
                            dataUrl,
                          })
                        }
                        await bootstrapReceipt('App')
                      } catch {
                        /* user cancelled camera/file picker */
                      }
                    })()
                  }}
                >
                  {receiptBusy ? 'Lendo foto…' : 'Enviar Foto'}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {monthClosed && !showForm ? <p className={styles.muted}>{closedMonthMessage}</p> : null}
      <ReceiptReadingOverlay
        open={receiptBusy}
        purpose={readingPurpose}
        rerouted={readingRerouted}
        message={
          readingRerouted ? (
            <>
              Sem valor pago: você está lançando um <WordOrcamento />. Abrindo para escolher conta e
              categoria…
            </>
          ) : (
            <>
              Identificando se é cupom (<WordLancamento />) ou boleto (<WordOrcamento />).
            </>
          )
        }
      />
      <ErrorText message={openError ?? monthStatus.error ?? rowAction.error} />

      {showForm ? (
        mode === 'edit' && !editing ? (
          <Loading />
        ) : (
          <EntryForm
            key={editing?.id ?? receiptIntakeId ?? 'new'}
            initial={mode === 'edit' ? editing : null}
            receiptPrefill={mode === 'edit' ? null : receiptPrefill}
            receiptIntakeId={mode === 'edit' ? null : receiptIntakeId}
            accounts={lookups.accounts.map((account) => ({ id: account.id, name: account.name }))}
            categories={filterAccountOptions.filter((account) => account.level === 'Analytical' && account.isActive)}
            tree={lookups.categories}
            onDirtyChange={setFormDirty}
            onCancel={() => void closeForm()}
            onSaved={(saveMode = 'close') => {
              setFormDirty(false)
              setEditing(null)
              setReceiptPrefill(null)
              setReceiptIntakeId(null)
              takePendingIntakeId()
              takePendingShare()
              entries.reload()
              lookups.reloadAccounts()
              if (saveMode === 'close') {
                navigate('/lancamentos')
              }
            }}
          />
        )
      ) : null}

      <ReceiptClassifyDialog
        open={classifyOpen}
        intake={receiptIntake}
        rerouteHint={classifyRerouteHint}
        onClose={() => {
          setClassifyOpen(false)
          setClassifyRerouteHint(null)
        }}
        onClassified={(intake) => {
          setClassifyOpen(false)
          setClassifyRerouteHint(null)
          if (intake.status === 'Confirmed') {
            takePendingIntakeId()
            showSaveToast('Lançamento gravado.')
            navigate('/lancamentos')
            entries.reload()
            return
          }
          if (intake.needsClassification || intake.status === 'NeedsClassification') {
            setReceiptIntake(intake)
            setClassifyOpen(true)
            return
          }
          applyIntakeToForm(intake)
        }}
      />

      {!showForm ? listSection : null}
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
  onSaved: (mode?: 'close' | 'continue') => void
}

function matchesEntryType(section: string, type: FormType): boolean {
  if (type === 'Income') {
    return section === 'Income' || section === 'LifeProject' || section === 'Asset' || section === 'Liability'
  }
  return section === 'Discount' || section === 'Essential' || section === 'Social' || section === 'Debt' || section === 'Asset' || section === 'Liability'
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
  const { plan } = usePlanAccess()
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
  const [categoryId, setCategoryId] = useState(
    () => initial?.categoryId ?? receiptPrefill?.categoryId ?? '',
  )
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const action = useAction()

  useEffect(() => {
    if (initial) {
      return
    }
    return subscribeVoiceFill((fill) => {
      const nextType: FormType = fill.type === 'Income' ? 'Income' : 'Expense'
      if (fill.type) {
        setType(nextType)
      }
      if (fill.amount != null) {
        setAmount(formatMoneyInput(fill.amount))
      }
      if (fill.date) {
        setDate(resolveSpokenDate(fill.date))
      }
      if (fill.description) {
        setDescription(fill.description)
      }
      const pool = categories.filter((category) => matchesEntryType(category.section, fill.type ? nextType : type))
      const category = matchByName(fill.categoryName, pool)
      if (category) {
        setCategoryId(category.id)
      }
      const account = matchByName(fill.accountName, accounts)
      if (account) {
        setAccountId(account.id)
      }
      onDirtyChange?.(true)
    })
  }, [accounts, categories, initial, onDirtyChange, type])

  function focusAmount() {
    window.requestAnimationFrame(() => {
      amountInputRef.current?.focus()
      amountInputRef.current?.select()
    })
  }

  const skipDirtyRef = useRef(false)

  function resetForNextEntry() {
    skipDirtyRef.current = true
    setAmount('')
    setDate(todayInput())
    setDescription('')
    onDirtyChange?.(false)
    focusAmount()
  }

  const baseline = {
    type: (initial && isEditableType(initial.type) ? initial.type : 'Expense') as FormType,
    amount: initial ? formatMoneyInput(initial.amount) : (receiptPrefill?.amount ?? ''),
    date: initial ? toDateInput(initial.occurredAt) : (receiptPrefill?.date ?? todayInput()),
    description: initial
      ? initial.description
      : (receiptPrefill?.description ??
        (pendingReceipt ? pendingReceipt.fileName.replace(/\.[^.]+$/, '') : '')),
    accountId: initial?.accountId ?? receiptPrefill?.accountId ?? '',
    categoryId: initial?.categoryId ?? receiptPrefill?.categoryId ?? '',
  }

  const kindCategories = categories.filter((category) => matchesEntryType(category.section, type))
  const writableKindCategories = kindCategories.filter((category) => isCategoryWritable(plan, category))
  const noWritableCategories = !editing && kindCategories.length > 0 && writableKindCategories.length === 0

  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false
      onDirtyChange?.(false)
      return
    }
    const dirty =
      type !== baseline.type ||
      amount !== baseline.amount ||
      date !== baseline.date ||
      description !== baseline.description ||
      accountId !== baseline.accountId ||
      categoryId !== baseline.categoryId
    onDirtyChange?.(dirty)
  }, [
    type,
    amount,
    date,
    description,
    accountId,
    categoryId,
    baseline.type,
    baseline.amount,
    baseline.date,
    baseline.description,
    baseline.accountId,
    baseline.categoryId,
    onDirtyChange,
  ])

  async function suggest() {
    if (editing || categoryId || description.trim().length < 3) {
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
    if (noWritableCategories) {
      action.setError(
        type === 'Income'
          ? FREE_TIER_INCOME_ENTRY_HINT
          : 'Nenhuma categoria disponível neste plano para este tipo de lançamento.',
      )
      return
    }
    if (!accountId) {
      action.setError('Selecione a conta bancária para concluir o lançamento.')
      return
    }
    if (!categoryId) {
      action.setError('Selecione a categoria para concluir o lançamento.')
      return
    }

    if (editing && initial) {
      const input: EntryUpdateInput = {
        amount: value,
        occurredAt: dateToApi(date),
        description: description.trim(),
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        incomeSourceId: type === 'Income' ? initial.incomeSourceId ?? undefined : undefined,
        memberId: initial.memberId ?? undefined,
        confirmDuplicate,
      }
      if (await action.run(() => entriesApi.update(initial.id, input))) {
        showSaveToast('Lançamento salvo.')
        onSaved('close')
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
        onSaved('close')
      }
      return
    }

    const input: EntryInput = {
      type,
      amount: value,
      occurredAt: dateToApi(date),
      description: description.trim(),
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
      confirmDuplicate,
    }

    if (await action.run(() => entriesApi.create(input))) {
      showSaveToast('Lançamento salvo.')
      resetForNextEntry()
      onSaved('continue')
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
        {noWritableCategories ? (
          <p className={`${styles.muted} ${styles.formWide}`} role="status">
            {type === 'Income' ? FREE_TIER_INCOME_ENTRY_HINT : `${PAID_MODULE_BADGE}.`}{' '}
            <Link to="/plano">Ver planos</Link>
          </p>
        ) : null}
        <MoneyField
          label="Valor (R$)"
          name="amount"
          required
          value={amount}
          onChange={setAmount}
          inputRef={amountInputRef}
        />
        <Field label="Data" name="date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        <CategorySelect
          label="Categoria"
          name="categoryId"
          value={categoryId}
          onChange={setCategoryId}
          options={writableKindCategories}
          tree={tree}
          emptyLabel="Selecione a categoria"
        />
        <Select
          label="Conta bancária"
          name="accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          aria-required
        >
          <option value="">Selecione conta bancária</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
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
