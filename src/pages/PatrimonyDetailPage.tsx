import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { patrimonyApi, type PatrimonyItem } from '../api/finance'
import { CategorySelect } from '../components/CategorySelect'
import { PageHeader } from '../components/PageHeader'
import { PaidModuleBadge } from '../components/PaidModuleBadge'
import { Button } from '../components/ui/Button'
import { DeleteIconButton } from '../components/ui/DeleteIconButton'
import { Badge, ErrorText, Loading } from '../components/ui/Feedback'
import { Field } from '../components/ui/Field'
import { MoneyField } from '../components/ui/MoneyField'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { useLookups } from '../hooks/useLookups'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { useRegisterDirty } from '../hooks/useUnsavedChanges'
import { confirmDestructive } from '../lib/confirm'
import { hasFullAccess } from '../lib/freeTier'
import { formatMoney, formatMoneyInput, parseMoney } from '../lib/format'
import { showSaveToast } from '../lib/saveToast'
import pageStyles from './pageStyles'
import cadastroStyles from './cadastros/cadastros.module.css'
const styles = { ...pageStyles, ...cadastroStyles }

export function PatrimonyDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { plan } = usePlanAccess()
  const canWrite = hasFullAccess(plan)
  const summary = useLoad(() => patrimonyApi.get(), [])
  const remove = useAction()
  const data = useMemo(
    () => summary.data?.items.find((item) => item.id === id) ?? null,
    [summary.data, id],
  )

  async function removeItem() {
    if (!data || !canWrite) {
      return
    }
    if (!(await confirmDestructive(`Excluir "${data.name}"?`, { title: 'Excluir item' }))) {
      return
    }
    if (await remove.run(() => patrimonyApi.remove(data.id))) {
      showSaveToast('Item excluído.')
      navigate('/patrimonio')
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        kicker="Cadastros"
        title={data?.name ?? 'Item'}
        actions={
          <div className={styles.cadastroDetailActions}>
            {!canWrite ? <PaidModuleBadge /> : null}
            {canWrite && data ? (
              <DeleteIconButton className={styles.cadastroDetailDelete} onClick={() => void removeItem()} />
            ) : null}
          </div>
        }
      />
      <ErrorText message={summary.error ?? remove.error} />
      {summary.loading && !summary.data ? <Loading /> : null}
      {!summary.loading && summary.data && !data ? (
        <ErrorText message="Item de patrimônio não encontrado." />
      ) : null}

      {data ? (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.rowMain}>
                <span className={styles.cadastroBadgeRow}>
                  <Badge tone={data.section === 'Asset' ? 'ok' : 'danger'}>
                    {data.section === 'Asset' ? 'Ativo' : 'Passivo'}
                  </Badge>
                </span>
                <span className={styles.rowSub}>
                  {formatMoney(data.amount)}
                  {data.categoryName ? ` · ${data.categoryName}` : ''}
                  {data.groupName ? ` · ${data.groupName}` : ''}
                </span>
              </span>
            </div>
          </section>

          {canWrite ? (
            <PatrimonyEditForm key={data.id} data={data} onSaved={() => summary.reload()} />
          ) : (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Detalhes</h2>
              <p className={styles.muted}>Cadastro e edição ficam nos planos pagos.</p>
            </section>
          )}

          <p className={styles.muted}>
            <Link to="/patrimonio" className={styles.cadastroDetailBack}>
              ← Voltar ao patrimônio
            </Link>
          </p>
        </>
      ) : null}
    </div>
  )
}

function PatrimonyEditForm({ data, onSaved }: { data: PatrimonyItem; onSaved: () => void }) {
  const lookups = useLookups()
  const options = lookups.patrimonyAccounts
  const save = useAction()
  const [categoryId, setCategoryId] = useState(data.categoryId)
  const [name, setName] = useState(data.name)
  const [amount, setAmount] = useState(formatMoneyInput(data.amount))

  const isDirty = useMemo(
    () =>
      categoryId !== data.categoryId ||
      name.trim() !== data.name ||
      parseMoney(amount) !== data.amount,
    [categoryId, name, amount, data],
  )

  useRegisterDirty(`patrimony-edit:${data.id}`, isDirty)

  useEffect(() => {
    setCategoryId(data.categoryId)
    setName(data.name)
    setAmount(formatMoneyInput(data.amount))
  }, [data])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = parseMoney(amount)
    if (!categoryId) {
      save.setError('Escolha a categoria.')
      return
    }
    if (!name.trim()) {
      save.setError('Informe o nome do item.')
      return
    }
    if (!Number.isFinite(value) || value < 0) {
      save.setError('Valor inválido.')
      return
    }
    if (
      await save.run(() => patrimonyApi.update(data.id, categoryId, name.trim(), value))
    ) {
      showSaveToast('Item de patrimônio salvo.')
      onSaved()
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Editar item</h2>
      <p className={styles.muted}>
        Atualize nome, categoria e valor. Ativo e passivo vêm da categoria escolhida.
      </p>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.formWide}>
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
        </div>
        <div className={styles.formWide}>
          <Field
            label="Nome"
            name="patrimonyName"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Civic 2018, apartamento, empréstimo X"
          />
        </div>
        <MoneyField label="Valor (R$)" name="patrimonyAmount" required value={amount} onChange={setAmount} />
        <div className={styles.formWide}>
          <ErrorText message={save.error} />
        </div>
        <div className={styles.formActions}>
          <Button type="submit" disabled={save.busy || !isDirty || options.length === 0}>
            Salvar item
          </Button>
        </div>
      </form>
    </section>
  )
}
