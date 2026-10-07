import { useEffect, useState, type FormEvent } from 'react'
import { categoriesApi, type Category, type CategoryKind } from '../api/finance'
import { PageHeader } from '../components/PageHeader'
import { Pager } from '../components/Pager'
import { Button } from '../components/ui/Button'
import { Badge, Empty, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { useAction } from '../hooks/useAction'
import { useClientPagination } from '../hooks/useClientPagination'
import { useLoad } from '../hooks/useLoad'
import { confirmDestructive } from '../lib/confirm'
import styles from './page.module.css'

const KIND_LABEL: Record<CategoryKind, string> = {
  Expense: 'Despesa',
  Income: 'Receita',
  Transfer: 'Transferência',
}

export function CategoriesPage() {
  const categories = useLoad(() => categoriesApi.list(undefined, true), [])
  const remove = useAction()
  const [editing, setEditing] = useState<Category | null>(null)
  const list = [...(categories.data ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
  )
  const pagination = useClientPagination(list, 10)

  async function removeCategory(category: Category) {
    const ok = await confirmDestructive(`Excluir "${category.name}"? Esta ação não pode ser desfeita.`, {
      title: 'Excluir categoria',
    })
    if (!ok) {
      return
    }
    if (await remove.run(() => categoriesApi.remove(category.id))) {
      if (editing?.id === category.id) {
        setEditing(null)
      }
      categories.reload()
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader secondary title="Categorias" />
      <ErrorText message={categories.error ?? remove.error} />
      {categories.loading && !categories.data ? <Loading /> : null}
      {categories.data && categories.data.length === 0 ? <Empty>Nenhuma categoria.</Empty> : null}
      {(Object.keys(KIND_LABEL) as CategoryKind[]).map((kind) => {
        const items = pagination.pageItems.filter((category) => category.kind === kind)
        return items.length === 0 ? null : (
          <section key={kind} className={styles.section}>
            <h2 className={styles.sectionTitle}>{KIND_LABEL[kind]}</h2>
            <ul className={styles.list}>
              {items.map((category) => (
                <li key={category.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <strong>{category.name}</strong>
                    <span className={styles.rowSub}>{category.isEssential ? 'Essencial' : 'Não essencial'}</span>
                  </span>
                  <span className={styles.rowEnd}>
                    {category.isSystem ? <Badge>Do sistema</Badge> : <Badge tone="ok">Personalizada</Badge>}
                    {category.isActive ? null : <Badge tone="warning">Inativa</Badge>}
                    {category.isSystem ? null : (
                      <>
                        <Button variant="ghost" onClick={() => setEditing(category)}>
                          Editar
                        </Button>
                        <Button variant="ghost" disabled={remove.busy} onClick={() => void removeCategory(category)}>
                          Excluir
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <Pager
        page={pagination.page}
        pageCount={pagination.pageCount}
        total={pagination.total}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
      />
      <CategoryForm
        editing={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          categories.reload()
        }}
      />
    </div>
  )
}

function CategoryForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing: Category | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('Expense')
  const [essential, setEssential] = useState(false)
  const [active, setActive] = useState(true)
  const action = useAction()

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setKind(editing.kind)
      setEssential(editing.isEssential)
      setActive(editing.isActive)
      requestAnimationFrame(() => {
        document.getElementById('categoria-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        document.querySelector<HTMLInputElement>('#categoria-form input[name="categoryName"]')?.focus()
      })
      return
    }
    setName('')
    setKind('Expense')
    setEssential(false)
    setActive(true)
  }, [editing])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }
    const ok = editing
      ? await action.run(() => categoriesApi.update(editing.id, trimmed, essential, active))
      : await action.run(() => categoriesApi.create(trimmed, kind, essential))
    if (ok) {
      setName('')
      setEssential(false)
      setActive(true)
      onSaved()
    }
  }

  return (
    <section className={styles.section} id="categoria-form">
      <h2 className={styles.sectionTitle}>{editing ? 'Editar categoria' : 'Nova categoria'}</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Nome" name="categoryName" required value={name} onChange={(event) => setName(event.target.value)} />
        <Select
          label="Tipo"
          name="categoryKind"
          value={kind}
          disabled={Boolean(editing)}
          onChange={(event) => setKind(event.target.value as CategoryKind)}
        >
          <option value="Expense">Despesa</option>
          <option value="Income">Receita</option>
        </Select>
        <label className={styles.formWide}>
          <input type="checkbox" checked={essential} onChange={(event) => setEssential(event.target.checked)} /> Gasto essencial
          (entra no cálculo da reserva)
        </label>
        {editing ? (
          <label className={styles.formWide}>
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Ativa
          </label>
        ) : null}
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          {editing ? (
            <Button type="button" variant="ghost" disabled={action.busy} onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" disabled={action.busy || !name.trim()}>
            {editing ? 'Salvar' : 'Criar categoria'}
          </Button>
        </div>
      </form>
    </section>
  )
}
