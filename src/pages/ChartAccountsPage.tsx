import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  chartAccountsApi,
  type ChartAccount,
  type ChartSection,
} from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import styles from './page.module.css'

const SECTION_ORDER: ChartSection[] = [
  'Income',
  'Discount',
  'LifeProject',
  'Essential',
  'Social',
  'Asset',
  'Liability',
]

const SECTION_HINT: Record<ChartSection, string> = {
  Income: 'o que entra',
  Discount: 'o que reduz a renda',
  LifeProject: 'o que você separa para o futuro',
  Essential: 'o que a casa precisa',
  Social: 'o que é escolha',
  Asset: 'o que você tem',
  Liability: 'o que você deve',
}

export function ChartAccountsPage() {
  const accounts = useLoad(() => chartAccountsApi.list(undefined, true), [])
  const action = useAction()
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTION_ORDER.map((section) => [section, true])),
  )
  const [draftParentId, setDraftParentId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')

  const list = accounts.data ?? []
  const byParent = useMemo(() => {
    const map = new Map<string | null, ChartAccount[]>()
    for (const account of list) {
      const key = account.parentId
      const bucket = map.get(key) ?? []
      bucket.push(account)
      map.set(key, bucket)
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
    }
    return map
  }, [list])

  const roots = SECTION_ORDER.map((section) =>
    list.find((account) => account.level === 'Root' && account.section === section),
  ).filter(Boolean) as ChartAccount[]

  const needle = query.trim().toLowerCase()
  const matches = needle
    ? new Set(list.filter((account) => account.name.toLowerCase().includes(needle)).map((account) => account.id))
    : null

  function sectionVisible(root: ChartAccount): boolean {
    if (!matches) {
      return true
    }
    if (matches.has(root.id)) {
      return true
    }
    const walk = (id: string): boolean => {
      const children = byParent.get(id) ?? []
      return children.some((child) => matches.has(child.id) || walk(child.id))
    }
    return walk(root.id)
  }

  async function createUnder(parentId: string) {
    const name = draftName.trim()
    if (!name) {
      return
    }
    if (await action.run(() => chartAccountsApi.create(name, parentId))) {
      setDraftName('')
      setDraftParentId(null)
      accounts.reload()
    }
  }

  async function saveRename(account: ChartAccount) {
    const name = renameName.trim()
    if (!name) {
      return
    }
    if (await action.run(() => chartAccountsApi.update(account.id, name, account.isActive))) {
      setRenameId(null)
      accounts.reload()
    }
  }

  async function removeAccount(account: ChartAccount) {
    const ok = await confirmDestructive(`Excluir "${account.name}"?`, { title: 'Excluir conta' })
    if (!ok) {
      return
    }
    if (await action.run(() => chartAccountsApi.remove(account.id))) {
      accounts.reload()
    }
  }

  async function deactivate(account: ChartAccount) {
    if (await action.run(() => chartAccountsApi.update(account.id, account.name, false))) {
      accounts.reload()
    }
  }

  function renderAnalytical(account: ChartAccount) {
    if (matches && !matches.has(account.id) && !needle) {
      return null
    }
    if (matches && !matches.has(account.id)) {
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
              <strong>{account.name}</strong>
              <span className={styles.rowSub}>
                {account.isSystem ? 'Padrão' : 'Sua conta'}
                {account.isActive ? '' : ' · Inativa'}
              </span>
            </>
          )}
        </span>
        <span className={styles.rowEnd}>
          {account.isSystem ? <Badge>Padrão</Badge> : <Badge tone="ok">Sua conta</Badge>}
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
                <Button variant="ghost" disabled={action.busy} onClick={() => void removeAccount(account)}>
                  Excluir
                </Button>
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

  function renderChildren(parent: ChartAccount) {
    const children = byParent.get(parent.id) ?? []
    const groups = children.filter((child) => child.level === 'Group')
    const leaves = children.filter((child) => child.level === 'Analytical')
    const addParentId = groups.length > 0 ? null : parent.id

    return (
      <>
        {groups.map((group) => {
          const groupLeaves = byParent.get(group.id) ?? []
          const visibleLeaves = matches
            ? groupLeaves.filter((leaf) => matches.has(leaf.id))
            : groupLeaves
          if (matches && visibleLeaves.length === 0 && !matches.has(group.id)) {
            return null
          }
          return (
            <div key={group.id} className={styles.section} style={{ marginLeft: 12 }}>
              <h3 className={styles.sectionTitle}>
                {group.name} <Badge>Soma</Badge>
              </h3>
              <ul className={styles.list}>{visibleLeaves.map((leaf) => renderAnalytical(leaf))}</ul>
              {draftParentId === group.id ? (
                <form
                  className={styles.form}
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault()
                    void createUnder(group.id)
                  }}
                >
                  <Field
                    label="Nova conta"
                    name={`new-${group.id}`}
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
                    setDraftParentId(group.id)
                    setDraftName('')
                  }}
                >
                  Nova conta
                </Button>
              )}
            </div>
          )
        })}
        {leaves.length > 0 ? <ul className={styles.list}>{leaves.map((leaf) => renderAnalytical(leaf))}</ul> : null}
        {addParentId ? (
          draftParentId === addParentId ? (
            <form
              className={styles.form}
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                void createUnder(addParentId)
              }}
            >
              <Field
                label="Nova conta"
                name={`new-${addParentId}`}
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
                setDraftParentId(addParentId)
                setDraftName('')
              }}
            >
              Nova conta
            </Button>
          )
        ) : null}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Plano de contas" />
      <p className={styles.muted}>
        O lançamento entra na conta analítica. As contas de cima só somam.{' '}
        <Link to="/ajuda#plano-de-contas">Central de ajuda</Link>
      </p>
      <Field
        label="Buscar"
        name="chartSearch"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ex.: aluguel, salário…"
      />
      <ErrorText message={accounts.error ?? action.error} />
      {accounts.loading && !accounts.data ? <Loading /> : null}
      {!accounts.loading && roots.length === 0 ? <Empty>Nenhuma conta.</Empty> : null}
      {roots.filter(sectionVisible).map((root) => {
        const open = openSections[root.section] ?? true
        return (
          <section key={root.id} className={styles.section}>
            <button
              type="button"
              className={styles.sectionTitle}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
              onClick={() => setOpenSections((current) => ({ ...current, [root.section]: !open }))}
            >
              <span>
                {root.name} — {SECTION_HINT[root.section]}
              </span>
              <Badge>Soma</Badge>
            </button>
            {open ? renderChildren(root) : null}
          </section>
        )
      })}
    </div>
  )
}
