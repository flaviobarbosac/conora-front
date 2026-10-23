import { useMemo, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { categoriesApi, familyApi, type Category } from '../api/finance'
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
  // Management screen keeps inactive rows so the owner can reactivate them.
  const accounts = useLoad(() => categoriesApi.list(undefined, true, false, true), [])
  const group = useLoad(() => familyApi.group(), [])
  const action = useAction()
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [draftParentId, setDraftParentId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const inGroup = Boolean(group.data?.groupId)
  const isBudgetOwner = Boolean(group.data?.isBudgetOwner)
  const canEditChart = !inGroup || isBudgetOwner

  useRegisterDirty(
    'categories-edit',
    (draftParentId !== null && draftName.trim() !== '') || (renameId !== null && renameName.trim() !== ''),
  )

  const list = accounts.data ?? []
  const pendingAncestorIds = useMemo(() => {
    const byId = new Map(list.map((account) => [account.id, account]))
    const marked = new Set<string>()
    for (const account of list) {
      if (!account.isPendingReview) {
        continue
      }
      let current: Category | undefined = account
      while (current) {
        marked.add(current.id)
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
    }
    return marked
  }, [list])

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

  async function setActive(account: Category, isActive: boolean) {
    if (
      await action.run(() =>
        categoriesApi.update(account.id, account.name, isActive),
      )
    ) {
      showSaveToast(isActive ? 'Categoria reativada.' : 'Categoria desativada.')
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

  async function approveAccount(account: Category) {
    if (await action.run(() => categoriesApi.approve(account.id))) {
      showSaveToast('Categoria aceita no plano.')
      accounts.reload()
    }
  }

  async function rejectAccount(account: Category) {
    const ok = await confirmDestructive(
      `Recusar "${account.name}"? Ela sai do plano de todos no grupo.`,
      { title: 'Recusar categoria' },
    )
    if (!ok) {
      return
    }
    if (await action.run(() => categoriesApi.reject(account.id))) {
      showSaveToast('Categoria recusada.')
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
          {isBudgetOwner
            ? 'O plano é o mesmo para o grupo. Linhas em vermelho estão sob análise — aceite ou recuse.'
            : 'O plano é o mesmo para o grupo. Só o responsável cria ou altera categorias.'}
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
              canEditChart={canEditChart}
              isBudgetOwner={isBudgetOwner}
              pendingAncestorIds={pendingAncestorIds}
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
              onSetActive={(item, active) => void setActive(item, active)}
              onApprove={(item) => void approveAccount(item)}
              onReject={(item) => void rejectAccount(item)}
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
  canEditChart,
  isBudgetOwner,
  pendingAncestorIds,
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
  onSetActive,
  onApprove,
  onReject,
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
  canEditChart: boolean
  isBudgetOwner: boolean
  pendingAncestorIds: Set<string>
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
  onSetActive: (account: Category, isActive: boolean) => void
  onApprove: (account: Category) => void
  onReject: (account: Category) => void
}) {
  const children = byParent.get(account.id) ?? []
  const canAdd =
    canEditChart && account.level !== 'Analytical' && acceptsAnalyticalChild(account.section)
  const drafting = draftParentId === account.id
  const renaming = renameId === account.id
  const expandable = children.length > 0 || canAdd
  const canManage = canEditChart && !account.isSystem && !account.isPendingReview
  const canReview =
    isBudgetOwner && account.level === 'Analytical' && Boolean(account.isPendingReview)
  const expanded = open.has(account.id) || drafting || pendingAncestorIds.has(account.id)
  const pendingTrail = pendingAncestorIds.has(account.id)
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
        className={`${styles.raioxRow} ${styles.categoriesRow} ${rowClass} ${pendingTrail ? styles.categoryPendingTrail : ''}`}
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
            {!account.isActive ? <span className={styles.rowSub}> · Desativada</span> : null}
            {account.isPendingReview ? (
              <span className={styles.rowSub}>
                {' '}
                · Sob análise
                {account.createdByName ? ` · ${account.createdByName}` : ''}
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
          {canReview && !renaming ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => onApprove(account)}>
                Aceitar
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => onReject(account)}>
                Recusar
              </Button>
            </>
          ) : null}
          {canManage && !renaming ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => onStartRename(account)}>
                Renomear
              </Button>
              {account.isActive ? (
                <Button variant="ghost" disabled={busy} onClick={() => onSetActive(account, false)}>
                  Desativar
                </Button>
              ) : (
                <Button variant="ghost" disabled={busy} onClick={() => onSetActive(account, true)}>
                  Reativar
                </Button>
              )}
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
              canEditChart={canEditChart}
              isBudgetOwner={isBudgetOwner}
              pendingAncestorIds={pendingAncestorIds}
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
              onSetActive={onSetActive}
              onApprove={onApprove}
              onReject={onReject}
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
