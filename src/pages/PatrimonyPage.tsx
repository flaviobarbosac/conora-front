import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { patrimonyApi } from '../api/finance'
import { CategorySelect } from '../components/CategorySelect'
import { PaidModuleBadge } from '../components/PaidModuleBadge'
import { PageHeader } from '../components/PageHeader'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { hasFullAccess } from '../lib/freeTier'
import { Pager } from '../components/Pager'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useClientPagination } from '../hooks/useClientPagination'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { useRegisterDirty, useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { showSaveToast } from '../lib/saveToast'
import { formatMoney, parseMoney } from '../lib/format'
import pageStyles from './pageStyles'
import cadastroStyles from './cadastros/cadastros.module.css'
const styles = { ...pageStyles, ...cadastroStyles }

type SectionFilter = 'Asset' | 'Liability'

function isSectionFilter(value: string | null): value is SectionFilter {
  return value === 'Asset' || value === 'Liability'
}

export function PatrimonyPage() {
  const navigate = useNavigate()
  const { plan } = usePlanAccess()
  const canWrite = hasFullAccess(plan)
  const { confirmLeave } = useUnsavedChanges()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterAccountId = searchParams.get('categoryId')
  const sectionFilter = isSectionFilter(searchParams.get('secao')) ? searchParams.get('secao') : null
  const summary = useLoad(() => patrimonyApi.get(), [])
  const [showForm, setShowForm] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const data = summary.data

  useRegisterDirty('patrimony-form', showForm && formDirty)

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    const searchQuery = searchParams.get('search')
    if (searchQuery != null && searchQuery !== '') {
      setSearch(searchQuery)
      setAppliedSearch(searchQuery.trim())
      next.delete('search')
      changed = true
    }
    if (changed) {
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const allItems = data?.items ?? []

  const items = useMemo(() => {
    let list = allItems
    if (sectionFilter) {
      list = list.filter((item) => item.section === sectionFilter)
    }
    if (filterAccountId) {
      list = list.filter((item) => item.categoryId === filterAccountId)
    }
    const needle = appliedSearch.trim().toLowerCase()
    if (needle) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          item.groupName.toLowerCase().includes(needle) ||
          (item.categoryName?.toLowerCase().includes(needle) ?? false),
      )
    }
    return list
  }, [allItems, sectionFilter, filterAccountId, appliedSearch])

  const pagination = useClientPagination(items, 10)

  const categorySummary = useMemo(() => {
    const map = new Map<
      string,
      { categoryId: string; categoryName: string; section: SectionFilter; amount: number; count: number }
    >()
    for (const item of allItems) {
      if (item.section !== 'Asset' && item.section !== 'Liability') {
        continue
      }
      const current = map.get(item.categoryId)
      if (current) {
        current.amount += item.amount
        current.count += 1
      } else {
        map.set(item.categoryId, {
          categoryId: item.categoryId,
          categoryName: item.categoryName || item.groupName,
          section: item.section,
          amount: item.amount,
          count: 1,
        })
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.section !== b.section) {
        return a.section === 'Asset' ? -1 : 1
      }
      return b.amount - a.amount
    })
  }, [allItems])

  function setSectionFilter(next: SectionFilter | null) {
    const params = new URLSearchParams()
    if (next) {
      params.set('secao', next)
    }
    if (filterAccountId) {
      params.set('categoryId', filterAccountId)
    }
    if (appliedSearch) {
      params.set('search', appliedSearch)
    }
    setSearchParams(params)
  }

  async function toggleForm() {
    if (showForm && formDirty && !(await confirmLeave())) {
      return
    }
    setShowForm((value) => !value)
    if (showForm) {
      setFormDirty(false)
    }
  }

  const assetCount = allItems.filter((item) => item.section === 'Asset').length
  const liabilityCount = allItems.filter((item) => item.section === 'Liability').length

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Cadastros"
        title="Patrimônio"
        actions={
          <>
            {!canWrite ? <PaidModuleBadge /> : null}
            {canWrite ? (
              <Button onClick={() => void toggleForm()}>
                {showForm ? 'Fechar cadastro' : 'Novo item'}
              </Button>
            ) : null}
          </>
        }
      />
      {!canWrite ? (
        <p className={styles.muted}>
          Você pode ver o patrimônio. Cadastro e edição ficam nos planos pagos.
        </p>
      ) : null}

      <div
        className={`${styles.segmented} ${styles.projectsHorizonFilter}`}
        role="group"
        aria-label="Filtro por tipo"
      >
        <button type="button" aria-pressed={!sectionFilter} onClick={() => setSectionFilter(null)}>
          Todos
        </button>
        <button
          type="button"
          aria-pressed={sectionFilter === 'Asset'}
          onClick={() => setSectionFilter('Asset')}
        >
          Ativo
        </button>
        <button
          type="button"
          aria-pressed={sectionFilter === 'Liability'}
          onClick={() => setSectionFilter('Liability')}
        >
          Passivo
        </button>
      </div>

      <form
        className={`${styles.toolbar} ${styles.projectsSearchBar}`}
        onSubmit={(event) => {
          event.preventDefault()
          setAppliedSearch(search.trim())
        }}
      >
        <Field
          label="Buscar itens"
          name="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <ErrorText message={summary.error} />
      {summary.loading && !data ? <Loading /> : null}

      {filterAccountId ? (
        <p className={styles.muted}>Lista filtrada pela conta do Raio-X.</p>
      ) : null}

      {data && items.length === 0 ? (
        <Empty>
          {appliedSearch || filterAccountId
            ? 'Nenhum item encontrado para este filtro.'
            : sectionFilter
              ? `Nenhum ${sectionFilter === 'Asset' ? 'ativo' : 'passivo'} cadastrado.`
              : canWrite
                ? 'Nenhum item ainda. Cadastre o primeiro pelo botão Novo item.'
                : 'Nenhum item cadastrado.'}
        </Empty>
      ) : null}

      {pagination.pageItems.map((item) => (
        <Link
          key={item.id}
          className={`${styles.section} ${styles.projectDashCard}`}
          to={`/patrimonio/${item.id}`}
        >
          <div className={styles.sectionHead}>
            <span className={styles.rowMain}>
              <strong className={styles.cadastroBadgeRow}>
                <span>{item.name}</span>
                <Badge tone={item.section === 'Asset' ? 'ok' : 'danger'}>
                  {item.section === 'Asset' ? 'Ativo' : 'Passivo'}
                </Badge>
              </strong>
              <span className={styles.rowSub}>
                {item.categoryName} · {item.groupName}
              </span>
            </span>
            <strong className={`${styles.amount} ${styles.moneyValue}`}>{formatMoney(item.amount)}</strong>
          </div>
        </Link>
      ))}

      <Pager
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />

      {showForm && canWrite ? (
        <PatrimonyCreateForm
          initialCategoryId={filterAccountId}
          onDirtyChange={setFormDirty}
          onCancel={() => {
            setShowForm(false)
            setFormDirty(false)
          }}
          onSaved={(id) => {
            setFormDirty(false)
            setShowForm(false)
            summary.reload()
            navigate(`/patrimonio/${id}`)
          }}
        />
      ) : null}

      {data ? (
        <section
          className={`${styles.horizonBlock} ${styles.projectsHorizonSummary}`}
          aria-label="Resumo por categoria"
        >
          <h2 className={styles.sectionTitle}>Resumo</h2>
          <div className={styles.horizonRow}>
            <span className={styles.horizonMeta}>
              <strong>Ativo</strong>
              <span>
                {assetCount} {assetCount === 1 ? 'item' : 'itens'} · {formatMoney(data.assetsTotal)}
              </span>
            </span>
          </div>
          <div className={styles.horizonRow}>
            <span className={styles.horizonMeta}>
              <strong>Passivo</strong>
              <span>
                {liabilityCount} {liabilityCount === 1 ? 'item' : 'itens'} ·{' '}
                {formatMoney(data.liabilitiesTotal)}
              </span>
            </span>
          </div>
          <div className={styles.horizonRow}>
            <span className={styles.horizonMeta}>
              <strong>Patrimônio líquido</strong>
              <span>{formatMoney(data.netWorth)}</span>
            </span>
          </div>
          {categorySummary.length > 0 ? (
            <>
              <h3 className={styles.sectionTitle}>Por categoria</h3>
              {categorySummary.map((row) => (
                <div key={row.categoryId} className={styles.horizonRow}>
                  <span className={styles.horizonMeta}>
                    <strong>
                      {row.categoryName}
                      <span className={styles.rowSub}>
                        {' '}
                        · {row.section === 'Asset' ? 'Ativo' : 'Passivo'}
                      </span>
                    </strong>
                    <span>
                      {row.count} {row.count === 1 ? 'item' : 'itens'} · {formatMoney(row.amount)}
                    </span>
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className={styles.muted}>Sem categorias com itens ainda.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}

function PatrimonyCreateForm({
  onSaved,
  onCancel,
  onDirtyChange,
  initialCategoryId,
}: {
  onSaved: (id: string) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  initialCategoryId: string | null
}) {
  const lookups = useLookups()
  const options = lookups.patrimonyAccounts
  const [categoryId, setCategoryId] = useState(() => initialCategoryId ?? '')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const action = useAction()

  const dirty =
    categoryId !== (initialCategoryId ?? '') || name.trim() !== '' || amount.trim() !== ''

  useRegisterDirty('patrimony-create-form', dirty)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (initialCategoryId) {
      setCategoryId(initialCategoryId)
    }
  }, [initialCategoryId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!categoryId) {
      action.setError('Escolha a categoria.')
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
    let createdId = ''
    if (
      await action.run(async () => {
        const item = await patrimonyApi.create(categoryId, name.trim(), value)
        createdId = item.id
      })
    ) {
      showSaveToast('Item de patrimônio adicionado.')
      onSaved(createdId)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Novo item</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <CategorySelect
          label="Categoria"
          name="patrimonyAccount"
          required
          value={categoryId}
          onChange={setCategoryId}
          options={options}
          tree={lookups.categories}
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
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  )
}
