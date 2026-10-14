import { useMemo, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { categoriesApi, familyApi, type Category, type SharingScope } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Icon } from '../components/ui/Icon'
import { Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { showSaveToast } from '../lib/saveToast'
import { categoryLabel } from '../lib/categoryLabel'
import { acceptsAnalyticalChild, compareCategorySiblings } from '../lib/categoryOrder'
import { groupAccountsByParent } from '../lib/raioX'
import styles from './page.module.css'

export function CategoriesPage() {
  const accounts = useLoad(() => categoriesApi.list(undefined, true), [])
  const group = useLoad(() => familyApi.group(), [])
  const action = useAction()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [draftParentId, setDraftParentId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const inGroup = Boolean(group.data?.groupId)

  async function toggleSharing(account: Category) {
    const next: SharingScope = (account.sharingScope ?? 'Personal') === 'Family' ? 'Personal' : 'Family'
    if (await action.run(() => categoriesApi.updateSharing(account.id, next))) {
      showSaveToast(next === 'Family' ? 'Conta no consolidado familiar.' : 'Conta só pessoal.')
      accounts.reload()
    }
  }

  useRegisterDirty(
    'categories-edit',
    (draftParentId !== null && draftName.trim() !== '') || (renameId !== null && renameName.trim() !== ''),
  )

  const list = accounts.data ?? []
  const byParent = useMemo(() => {
    const map = groupAccountsByParent(list)
    for (const bucket of map.values()) {
      bucket.sort(compareCategorySiblings)
    }
    return map
  }, [list])

  const roots = useMemo(() => byParent.get(null) ?? [], [byParent])

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function createUnder(parentId: string) {
    const name = draftName.trim()
    if (!name) {
      return
    }
    if (await action.run(() => categoriesApi.create(name, parentId))) {
      showSaveToast('Categoria salva.')
      setDraftName('')
      setDraftParentId(null)
      setOpen((current) => new Set(current).add(parentId))
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
      showSaveToast('Categoria excluída.')
      accounts.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Categorias" />
      <ErrorText message={accounts.error ?? action.error} />
      {accounts.loading && !accounts.data ? <Loading /> : null}
      {!accounts.loading && roots.length === 0 ? <Empty>Nenhuma categoria.</Empty> : null}
      {inGroup ? (
        <p className={styles.muted}>
          No grupo, contas começam como Família. Marque como Pessoal as que não devem entrar no Raio-X consolidado.
        </p>
      ) : null}
      {roots.length > 0 ? (
        <div className={styles.raioxList}>
          <div className={`${styles.raioxRow} ${styles.raioxHead} ${styles.categoriesRow}`}>
            <span />
            <span>Categoria</span>
            <span />
          </div>
          {roots.map((account) => (
            <CategoryTreeRow
              key={account.id}
              account={account}
              depth={0}
              byParent={byParent}
              open={open}
              draftParentId={draftParentId}
              draftName={draftName}
              renameId={renameId}
              renameName={renameName}
              busy={action.busy}
              inGroup={inGroup}
              onToggleSharing={(item) => void toggleSharing(item)}
              onToggle={toggle}
              onDraftParent={(parentId) => {
                setDraftParentId(parentId)
                setDraftName('')
                setRenameId(null)
                setOpen((current) => new Set(current).add(parentId))
              }}
              onDraftName={setDraftName}
              onCancelDraft={() => {
                setDraftParentId(null)
                setDraftName('')
              }}
              onCreate={(parentId) => void createUnder(parentId)}
              onStartRename={(item) => {
                setRenameId(item.id)
                setRenameName(item.name)
                setDraftParentId(null)
                setDraftName('')
              }}
              onRenameName={setRenameName}
              onCancelRename={() => setRenameId(null)}
              onSaveRename={(item) => void saveRename(item)}
              onRemove={(item) => void removeAccount(item)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CategoryTreeRow({
  account,
  depth,
  byParent,
  open,
  draftParentId,
  draftName,
  renameId,
  renameName,
  busy,
  inGroup,
  onToggleSharing,
  onToggle,
  onDraftParent,
  onDraftName,
  onCancelDraft,
  onCreate,
  onStartRename,
  onRenameName,
  onCancelRename,
  onSaveRename,
  onRemove,
}: {
  account: Category
  depth: number
  byParent: Map<string | null, Category[]>
  open: Set<string>
  draftParentId: string | null
  draftName: string
  renameId: string | null
  renameName: string
  busy: boolean
  inGroup: boolean
  onToggleSharing: (account: Category) => void
  onToggle: (id: string) => void
  onDraftParent: (parentId: string) => void
  onDraftName: (value: string) => void
  onCancelDraft: () => void
  onCreate: (parentId: string) => void
  onStartRename: (account: Category) => void
  onRenameName: (value: string) => void
  onCancelRename: () => void
  onSaveRename: (account: Category) => void
  onRemove: (account: Category) => void
}) {
  const children = byParent.get(account.id) ?? []
  // Only non-analytical parents in posting sections may receive a new leaf (API rejects analytical parents).
  const canAdd = account.level !== 'Analytical' && acceptsAnalyticalChild(account.section)
  const drafting = draftParentId === account.id
  const renaming = renameId === account.id
  const expandable = children.length > 0 || canAdd
  const expanded = open.has(account.id) || drafting
  const rowClass =
    account.level === 'Root' ||
    account.section === 'Expense' ||
    account.section === 'Income' ||
    account.section === 'Patrimony'
      ? styles.raioxRoot
      : account.level === 'Group'
        ? styles.raioxGroup
        : styles.raioxLeaf

  function stop(event: MouseEvent) {
    event.stopPropagation()
  }

  return (
    <>
      <div
        className={`${styles.raioxRow} ${styles.categoriesRow} ${rowClass}`}
        style={{ paddingLeft: `calc(var(--space-4) + ${depth} * 1rem)` }}
      >
        <button
          type="button"
          className={styles.categoriesToggleBtn}
          onClick={() => (expandable ? onToggle(account.id) : undefined)}
          aria-expanded={expandable ? expanded : undefined}
          aria-label={expandable ? (expanded ? 'Recolher' : 'Expandir') : undefined}
          disabled={!expandable}
        >
          <span className={styles.raioxToggle} aria-hidden>
            {expandable ? (expanded ? '−' : '+') : ''}
          </span>
        </button>
        {renaming ? (
          <form
            className={styles.categoriesInlineForm}
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              onSaveRename(account)
            }}
          >
            <Field
              label="Nome"
              name={`rename-${account.id}`}
              value={renameName}
              autoFocus
              onChange={(event) => onRenameName(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Escape') {
                  onCancelRename()
                }
              }}
            />
            <Button type="submit" disabled={busy || !renameName.trim()}>
              Salvar
            </Button>
            <Button type="button" variant="ghost" onClick={onCancelRename}>
              Cancelar
            </Button>
          </form>
        ) : (
          <strong className={styles.raioxAccountName}>
            {categoryLabel(account)}
            {!account.isActive ? <span className={styles.rowSub}> · Inativa</span> : null}
            {inGroup && account.level === 'Analytical' ? (
              <span className={styles.rowSub}>
                {' '}
                · {(account.sharingScope ?? 'Personal') === 'Family' ? 'Família' : 'Pessoal'}
              </span>
            ) : null}
          </strong>
        )}
        <span className={styles.categoriesActions} onClick={stop}>
          {canAdd && !renaming ? (
            <Button
              variant="ghost"
              className={styles.categoriesIconBtn}
              aria-label="Nova categoria"
              title="Nova categoria"
              disabled={busy}
              onClick={() => onDraftParent(account.id)}
            >
              <Icon name="add" size={20} decorative />
            </Button>
          ) : null}
          {inGroup && account.level === 'Analytical' && !renaming ? (
            <Button variant="ghost" disabled={busy} onClick={() => onToggleSharing(account)}>
              {(account.sharingScope ?? 'Personal') === 'Family' ? 'Tornar pessoal' : 'Tornar família'}
            </Button>
          ) : null}
          {!account.isSystem && !renaming ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => onStartRename(account)}>
                Renomear
              </Button>
              {account.isActive ? (
                <DeleteIconButton disabled={busy} onClick={() => onRemove(account)} />
              ) : null}
            </>
          ) : null}
        </span>
      </div>
      {expanded
        ? children.map((child) => (
            <CategoryTreeRow
              key={child.id}
              account={child}
              depth={depth + 1}
              byParent={byParent}
              open={open}
              draftParentId={draftParentId}
              draftName={draftName}
              renameId={renameId}
              renameName={renameName}
              busy={busy}
              inGroup={inGroup}
              onToggleSharing={onToggleSharing}
              onToggle={onToggle}
              onDraftParent={onDraftParent}
              onDraftName={onDraftName}
              onCancelDraft={onCancelDraft}
              onCreate={onCreate}
              onStartRename={onStartRename}
              onRenameName={onRenameName}
              onCancelRename={onCancelRename}
              onSaveRename={onSaveRename}
              onRemove={onRemove}
            />
          ))
        : null}
      {expanded && drafting ? (
        <form
          className={`${styles.raioxRow} ${styles.categoriesRow} ${styles.raioxEntry} ${styles.categoriesInlineForm}`}
          style={{ paddingLeft: `calc(var(--space-4) + ${(depth + 1) * 1}rem)` }}
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            onCreate(account.id)
          }}
        >
          <span />
          <Field
            label="Nova categoria"
            name={`new-${account.id}`}
            value={draftName}
            autoFocus
            onChange={(event) => onDraftName(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Escape') {
                onCancelDraft()
              }
            }}
          />
          <span className={styles.categoriesActions}>
            <Button type="submit" disabled={busy || !draftName.trim()}>
              Salvar
            </Button>
            <Button type="button" variant="ghost" onClick={onCancelDraft}>
              Cancelar
            </Button>
          </span>
        </form>
      ) : null}
    </>
  )
}
