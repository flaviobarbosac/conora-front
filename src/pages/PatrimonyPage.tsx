import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { patrimonyApi, type PatrimonyItem } from '../api/finance'
import { CategorySelect } from '../components/CategorySelect'
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
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { formatMoney, formatMoneyInput, parseMoney } from '../lib/format'
import styles from './page.module.css'

export function PatrimonyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterAccountId = searchParams.get('categoryId')
  const summary = useLoad(() => patrimonyApi.get(), [])
  const remove = useAction()
  const [editing, setEditing] = useState<PatrimonyItem | null>(null)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const data = summary.data

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

  const items = useMemo(() => {
    let list = data?.items ?? []
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
  }, [data?.items, filterAccountId, appliedSearch])
  const pagination = useClientPagination(items, 10)

  async function removeItem(item: PatrimonyItem) {
    if (!(await confirmDestructive(`Excluir "${item.name}"?`, { title: 'Excluir item' }))) {
      return
    }
    if (await remove.run(() => patrimonyApi.remove(item.id))) {
      showSaveToast('Item excluído.')
      if (editing?.id === item.id) {
        setEditing(null)
      }
      summary.reload()
    }
  }

  function loadItem(item: PatrimonyItem) {
    setEditing(item)
    showSaveToast('Item carregado. Pronto para editar.', 1000)
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Patrimônio" />
      <ErrorText message={summary.error ?? remove.error} />
      {summary.loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <section className={styles.hero}>
            <div className={styles.heroTop}>
              <span>Composição</span>
            </div>
            <div className={styles.heroCards} aria-label="Saldos de patrimônio">
              <div className={styles.heroCard}>
                <span>Ativo</span>
                <strong className={`${styles.moneyValue} ${styles.positive}`}>
                  {formatMoney(data.assetsTotal)}
                </strong>
                <span className={styles.muted}>
                  Uso {formatMoney(data.assetsInUse)} · não uso {formatMoney(data.assetsNotInUse)}
                </span>
              </div>
              <div className={styles.heroCard}>
                <span>Passivo</span>
                <strong className={`${styles.moneyValue} ${styles.negative}`}>
                  {formatMoney(data.liabilitiesTotal)}
                </strong>
                <span className={styles.muted}>Itens de passivo</span>
              </div>
              <div className={`${styles.heroCard} ${styles.heroCardPatrimonyActive}`}>
                <span>Patrimônio líquido</span>
                <strong className={`${styles.moneyValue} ${data.netWorth < 0 ? styles.negative : ''}`}>
                  {formatMoney(data.netWorth)}
                </strong>
                <span className={styles.muted}>Ativo − passivo</span>
              </div>
            </div>
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
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Itens{filterAccountId ? ' · filtrados pela conta do Raio-X' : ''}
            </h2>
            <form
              className={styles.toolbar}
              onSubmit={(event) => {
                event.preventDefault()
                setAppliedSearch(search.trim())
              }}
            >
              <Field label="Buscar" name="search" value={search} onChange={(event) => setSearch(event.target.value)} />
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
            {items.length === 0 ? <Empty>Nenhum item cadastrado.</Empty> : null}
            <ul className={styles.list}>
              {pagination.pageItems.map((item) => (
                <li key={item.id} className={styles.row}>
                  <button type="button" className={styles.rowMain} onClick={() => loadItem(item)}>
                    <strong>{item.name}</strong>
                    <span className={styles.rowSub}>
                      {item.categoryName} · {item.groupName}
                    </span>
                  </button>
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
        key={editing?.id ?? 'new'}
        editing={editing}
        initialCategoryId={filterAccountId}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          summary.reload()
        }}
      />
    </div>
  )
}

function ItemForm({
  editing,
  onSaved,
  onCancel,
  initialCategoryId,
}: {
  editing: PatrimonyItem | null
  onSaved: () => void
  onCancel: () => void
  initialCategoryId: string | null
}) {
  const lookups = useLookups()
  const options = lookups.patrimonyAccounts
  const [categoryId, setCategoryId] = useState(
    () => editing?.categoryId ?? initialCategoryId ?? '',
  )
  const [name, setName] = useState(() => editing?.name ?? '')
  const [amount, setAmount] = useState(() => (editing ? formatMoneyInput(editing.amount) : ''))
  const action = useAction()

  const dirty =
    editing !== null
      ? categoryId !== editing.categoryId ||
        name !== editing.name ||
        parseMoney(amount) !== editing.amount
      : categoryId !== (initialCategoryId ?? '') || name.trim() !== '' || amount.trim() !== ''

  useRegisterDirty('patrimony-item-form', dirty)

  useEffect(() => {
    if (editing) {
      return
    }
    if (initialCategoryId) {
      setCategoryId(initialCategoryId)
    }
  }, [initialCategoryId, editing])

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
    const saved = editing
      ? await action.run(() => patrimonyApi.update(editing.id, categoryId, name.trim(), value))
      : await action.run(() => patrimonyApi.create(categoryId, name.trim(), value))
    if (saved) {
      showSaveToast(editing ? 'Item de patrimônio salvo.' : 'Item de patrimônio adicionado.')
      if (!editing) {
        setCategoryId(initialCategoryId ?? '')
        setName('')
        setAmount('')
      }
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{editing ? 'Editar item' : 'Novo item'}</h2>
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
            {editing ? 'Salvar' : 'Adicionar'}
          </Button>
          {editing ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
