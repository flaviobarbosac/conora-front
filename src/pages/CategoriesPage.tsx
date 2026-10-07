import { useState, type FormEvent } from 'react'
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
import styles from './page.module.css'

const KIND_LABEL: Record<CategoryKind, string> = {
  Expense: 'Despesa',
  Income: 'Receita',
  Transfer: 'Transferência',
}

export function CategoriesPage() {
  const categories = useLoad(() => categoriesApi.list(undefined, true), [])
  const remove = useAction()
  const list = categories.data ?? []
  const pagination = useClientPagination(list, 10)

  async function removeCategory(category: Category) {
    if (window.confirm(`Excluir "${category.name}"?`) && (await remove.run(() => categoriesApi.remove(category.id)))) {
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
                      <Button variant="ghost" disabled={remove.busy} onClick={() => void removeCategory(category)}>
                        Excluir
                      </Button>
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
      <CategoryForm onSaved={categories.reload} />
    </div>
  )
}

function CategoryForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('Expense')
  const [essential, setEssential] = useState(false)
  const action = useAction()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (await action.run(() => categoriesApi.create(name.trim(), kind, essential))) {
      setName('')
      setEssential(false)
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Nova categoria</h2>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Field label="Nome" name="categoryName" required value={name} onChange={(event) => setName(event.target.value)} />
        <Select label="Tipo" name="categoryKind" value={kind} onChange={(event) => setKind(event.target.value as CategoryKind)}>
          <option value="Expense">Despesa</option>
          <option value="Income">Receita</option>
        </Select>
        <label className={styles.formWide}>
          <input type="checkbox" checked={essential} onChange={(event) => setEssential(event.target.checked)} /> Gasto essencial
          (entra no cálculo da reserva)
        </label>
        <div className={styles.formWide}>
          <ErrorText message={action.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={action.busy}>
            Criar categoria
          </Button>
        </div>
      </form>
    </section>
  )
}
