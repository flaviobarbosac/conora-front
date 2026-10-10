import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { categoriesApi, type Category, type CategorySection } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { SearchableSelect } from '../components/SearchableSelect'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { categoryLabel } from '../lib/categoryLabel'
import { acceptsAnalyticalChild, compareCategorySiblings, sectionLabel } from '../lib/categoryOrder'
import styles from './page.module.css'

function sectionHint(section: CategorySection): string {
  switch (section) {
    case 'Budget':
      return 'o que entra e sai no mês'
    case 'Expense':
      return 'saídas do mês'
    case 'Patrimony':
      return 'o que você tem e o que deve'
    case 'Income':
      return 'o que entra (receita)'
    case 'Discount':
      return 'o que reduz a renda'
    case 'LifeProject':
      return 'o que você separa para o futuro'
    case 'Essential':
      return 'o que a casa precisa'
    case 'Social':
      return 'o que é escolha'
    case 'Asset':
      return 'o que você tem'
    case 'Liability':
      return 'o que você deve'
    default:
      return ''
  }
}

export function CategoriesPage() {
  const accounts = useLoad(() => categoriesApi.list(undefined, true), [])
  const action = useAction()
  const [query, setQuery] = useState('')
  const [typeFilterId, setTypeFilterId] = useState('')
  const [draftParentId, setDraftParentId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')

  useRegisterDirty(
    'categories-edit',
    (draftParentId !== null && draftName.trim() !== '') || (renameId !== null && renameName.trim() !== ''),
  )

  const list = accounts.data ?? []
  const byId = useMemo(() => new Map(list.map((item) => [item.id, item])), [list])
  const byParent = useMemo(() => {
    const map = new Map<string | null, Category[]>()
    for (const account of list) {
      const key = account.parentId
      const bucket = map.get(key) ?? []
      bucket.push(account)
      map.set(key, bucket)
    }
    for (const bucket of map.values()) {
      bucket.sort(compareCategorySiblings)
    }
    return map
  }, [list])

  const roots = useMemo(() => byParent.get(null) ?? [], [byParent])

  const typeOptions = useMemo(() => {
    return list
      .filter((item) => item.level !== 'Analytical')
      .map((item) => {
        const parent = item.parentId ? byId.get(item.parentId) : null
        return {
          value: item.id,
          label: item.name,
          hint: parent ? parent.name : sectionHint(item.section) || undefined,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [list, byId])

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? new Set(
        list
          .filter((account) => categoryLabel(account).toLowerCase().includes(needle))
          .map((account) => account.id),
      )
    : null

  function isUnderTypeFilter(account: Category): boolean {
    if (!typeFilterId) {
      return true
    }
    if (account.id === typeFilterId) {
      return true
    }
    let current: Category | undefined = account
    while (current?.parentId) {
      if (current.parentId === typeFilterId) {
        return true
      }
      current = byId.get(current.parentId)
    }
    return false
  }

  function isAncestorOfTypeFilter(account: Category): boolean {
    if (!typeFilterId) {
      return false
    }
    let current = byId.get(typeFilterId)
    while (current) {
      if (current.id === account.id) {
        return true
      }
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return false
  }

  function matchesTypeFilter(account: Category): boolean {
    if (!typeFilterId) {
      return true
    }
    return isUnderTypeFilter(account) || isAncestorOfTypeFilter(account)
  }

  function subtreeVisible(account: Category): boolean {
    if (!matchesTypeFilter(account)) {
      const hasMatchingDescendant = (id: string): boolean => {
        const kids = byParent.get(id) ?? []
        return kids.some((kid) => matchesTypeFilter(kid) || hasMatchingDescendant(kid.id))
      }
      if (!hasMatchingDescendant(account.id)) {
        return false
      }
    }
    if (!matches) {
      return true
    }
    if (matches.has(account.id)) {
      return true
    }
    const walk = (id: string): boolean => {
      const children = byParent.get(id) ?? []
      return children.some((child) => matches.has(child.id) || walk(child.id))
    }
    return walk(account.id)
  }

  const visibleRoots = roots.filter(subtreeVisible)

  async function createUnder(parentId: string) {
    const name = draftName.trim()
    if (!name) {
      return
    }
    if (await action.run(() => categoriesApi.create(name, parentId))) {
      showSaveToast('Categoria salva.')
      setDraftName('')
      setDraftParentId(null)
      accounts.reload()
    }
  }

  async function saveRename(account: Category) {
    const name = renameName.trim()
    if (!name) {
      return
    }
    if (await action.run(() => categoriesApi.update(account.id, name, account.isActive))) {
      showSaveToast('Categoria salva.')
      setRenameId(null)
      accounts.reload()
    }
  }

  async function removeAccount(account: Category) {
    const ok = await confirmDestructive(`Excluir "${account.name}"?`, { title: 'Excluir categoria' })
    if (!ok) {
      return
    }
    if (await action.run(() => categoriesApi.remove(account.id))) {
      accounts.reload()
    }
  }

  async function deactivate(account: Category) {
    if (await action.run(() => categoriesApi.update(account.id, account.name, false))) {
      showSaveToast('Categoria desativada.')
      accounts.reload()
    }
  }

  function renderAnalytical(account: Category) {
    if (matches && !matches.has(account.id)) {
      return null
    }
    if (typeFilterId && !isUnderTypeFilter(account) && account.id !== typeFilterId) {
      return null
    }
    const renaming = renameId === account.id
    return (
      <li key={account.id} className={styles.row}>
        <span className={styles.rowMain}>
          {renaming ? (
            <Field
              label="Nome"
              name={`rename-${account.id}`}
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void saveRename(account)
                }
                if (event.key === 'Escape') {
                  setRenameId(null)
                }
              }}
            />
          ) : (
            <>
              <strong>{categoryLabel(account)}</strong>
              {!account.isActive ? <span className={styles.rowSub}>Inativa</span> : null}
            </>
          )}
        </span>
        <span className={styles.rowEnd}>
          {!account.isSystem && !renaming ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setRenameId(account.id)
                  setRenameName(account.name)
                }}
              >
                Renomear
              </Button>
              {account.isActive ? (
                <DeleteIconButton disabled={action.busy} onClick={() => void removeAccount(account)} />
              ) : null}
              {account.isActive ? (
                <Button variant="ghost" disabled={action.busy} onClick={() => void deactivate(account)}>
                  Desativar
                </Button>
              ) : null}
            </>
          ) : null}
          {renaming ? (
            <>
              <Button onClick={() => void saveRename(account)}>Salvar</Button>
              <Button variant="ghost" onClick={() => setRenameId(null)}>
                Cancelar
              </Button>
            </>
          ) : null}
        </span>
      </li>
    )
  }

  function renderBranch(parent: Category, depth: number) {
    const children = (byParent.get(parent.id) ?? []).filter((child) => {
      if (!typeFilterId) {
        return true
      }
      return matchesTypeFilter(child) || subtreeVisible(child)
    })
    const groups = children.filter((child) => child.level !== 'Analytical')
    const leaves = children.filter((child) => child.level === 'Analytical')
    const canAdd = acceptsAnalyticalChild(parent.section)

    return (
      <>
        {groups.map((group) => {
          if (!subtreeVisible(group)) {
            return null
          }
          if (matches && !matches.has(group.id)) {
            const walk = (id: string): boolean => {
              const kids = byParent.get(id) ?? []
              return kids.some((kid) => matches.has(kid.id) || walk(kid.id))
            }
            if (!walk(group.id)) {
              return null
            }
          }
          return (
            <div key={group.id} className={styles.section} style={{ marginLeft: depth > 0 ? 12 : 0 }}>
              <h3 className={styles.sectionTitle}>
                {categoryLabel(group)}{' '}
                <span className={styles.muted}>{sectionHint(group.section) || sectionLabel(group.section)}</span>
              </h3>
              {renderBranch(group, depth + 1)}
            </div>
          )
        })}
        {leaves.length > 0 ? (
          <ul className={styles.list}>{leaves.map((leaf) => renderAnalytical(leaf))}</ul>
        ) : null}
        {canAdd ? (
          draftParentId === parent.id ? (
            <form
              className={styles.form}
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                void createUnder(parent.id)
              }}
            >
              <Field
                label="Nova categoria"
                name={`new-${parent.id}`}
                value={draftName}
                autoFocus
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === 'Escape') {
                    setDraftParentId(null)
                    setDraftName('')
                  }
                }}
              />
              <div className={styles.formActions}>
                <Button type="submit" disabled={action.busy || !draftName.trim()}>
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDraftParentId(null)
                    setDraftName('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setDraftParentId(parent.id)
                setDraftName('')
              }}
            >
              Nova categoria
            </Button>
          )
        ) : null}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Categorias" />
      <p className={styles.muted}>
        Orçamento é o mês (o que entra e sai). Patrimônio é o que você tem e o que deve. O lançamento entra na
        categoria analítica; as de cima só somam. <Link to="/ajuda#categorias">Central de ajuda</Link>
      </p>
      <div className={styles.toolbar}>
        <SearchableSelect
          label="Tipo"
          name="categoryType"
          value={typeFilterId}
          onChange={setTypeFilterId}
          options={typeOptions}
          emptyLabel="Todos"
          searchPlaceholder="Ex.: orçamento, essencial, cuidados…"
        />
        <Field
          label="Buscar"
          name="categorySearch"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: aluguel, salário…"
        />
      </div>
      <ErrorText message={accounts.error ?? action.error} />
      {accounts.loading && !accounts.data ? <Loading /> : null}
      {!accounts.loading && roots.length === 0 ? <Empty>Nenhuma categoria.</Empty> : null}
      {!accounts.loading && roots.length > 0 && visibleRoots.length === 0 ? (
        <Empty>{needle || typeFilterId ? 'Nenhuma categoria encontrada.' : 'Escolha uma categoria.'}</Empty>
      ) : null}
      {visibleRoots.map((root) => (
        <section key={root.id} className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {categoryLabel(root)} <span className={styles.muted}>{sectionHint(root.section)}</span>
          </h2>
          {renderBranch(root, 0)}
        </section>
      ))}
    </div>
  )
}
