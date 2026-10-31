import { useEffect, useId, useMemo, useState } from 'react'
import { categoriesApi, receiptsApi, type Category, type ReceiptIntake } from '../api/finance'
import type { ReceiptRerouteHint } from '../lib/receiptFlow'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { WordLancamento, WordOrcamento } from './ReceiptReadingOverlay'
import { Button } from './ui/Button'
import { ErrorText, Loading } from './ui/Feedback'
import { Field } from './ui/Field'
import { Select } from './ui/Select'
import styles from './IanAnalyzeDialog.module.css'

type Props = {
  open: boolean
  intake: ReceiptIntake | null
  /** Set when the photo arrived from the wrong screen (cupom↔boleto). */
  rerouteHint?: ReceiptRerouteHint | null
  onClose: () => void
  onClassified: (intake: ReceiptIntake) => void
}

export function ReceiptClassifyDialog({ open, intake, rerouteHint = null, onClose, onClassified }: Props) {
  const titleId = useId()
  const action = useAction()
  const createAction = useAction()
  const categories = useLoad(() => receiptsApi.categories(), [])
  const [filter, setFilter] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [parentId, setParentId] = useState('')

  useEffect(() => {
    if (!open) return
    setFilter('')
    setSelectedCode(intake?.proposedCategoryCode ?? '')
    setShowCreate(false)
    setNewName(intake?.extractedName?.trim() ?? '')
    setParentId('')
  }, [open, intake?.proposedCategoryCode, intake?.extractedName])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const items = useMemo(() => {
    const list = categories.data ?? []
    const needle = filter.trim().toLowerCase()
    if (!needle) return list
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.displayNumber ?? '').includes(needle) ||
        (c.code ?? '').toLowerCase().includes(needle),
    )
  }, [categories.data, filter])

  const similar = intake?.similarSuppliers ?? []

  if (!open || !intake) return null

  async function save() {
    if (!intake || !selectedCode) {
      action.setError('Escolha uma conta do plano.')
      return
    }
    let updated: ReceiptIntake | null = null
    const ok = await action.run(async () => {
      updated = await receiptsApi.classify(intake.id, selectedCode)
    })
    if (ok && updated) {
      onClassified(updated)
    }
  }

  async function link(supplierId: string) {
    let updated: ReceiptIntake | null = null
    const ok = await action.run(async () => {
      updated = await receiptsApi.linkSupplier(intake!.id, supplierId)
    })
    if (ok && updated) {
      onClassified(updated)
    }
  }

  async function createCategory() {
    const name = newName.trim()
    if (!name) {
      createAction.setError('Informe o nome da categoria.')
      return
    }
    if (!parentId) {
      createAction.setError('Escolha o grupo pai no plano de contas.')
      return
    }
    const created: { category: Category | null } = { category: null }
    const ok = await createAction.run(async () => {
      created.category = await categoriesApi.create(name, parentId)
    })
    if (ok && created.category) {
      await categories.reload()
      if (created.category.code) {
        setSelectedCode(created.category.code)
      }
      setShowCreate(false)
      createAction.setError(null)
    }
  }

  const isBoleto = intake.purpose === 'BudgetBoleto'
  const destClass = isBoleto ? styles.destBudget : styles.destExpense

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={`${styles.dialog} ${destClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <p className={styles.destBadge}>{isBoleto ? 'Orçamento' : 'Lançamento'}</p>
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {isBoleto ? 'Classificar boleto' : 'Classificar fornecedor'}
          </h2>
          <button type="button" className={styles.close} aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>
        {rerouteHint === 'to-budget' ? (
          <p className={styles.hint}>
            Sem valor pago: você está lançando um <WordOrcamento />. Escolha a conta e a categoria do{' '}
            <WordOrcamento /> antes de registrar.
          </p>
        ) : null}
        {rerouteHint === 'to-expense' ? (
          <p className={styles.hint}>
            Com valor pago: isso é um <WordLancamento />, não um <WordOrcamento />. Escolha a conta e a
            categoria do <WordLancamento /> antes de registrar.
          </p>
        ) : null}
        <p className={styles.hint}>
          {intake.extractedName
            ? `Fornecedor: ${intake.extractedName}${intake.extractedCnpj ? ` (CNPJ ${intake.extractedCnpj})` : ''}.`
            : 'Escolha a conta do plano. Com CNPJ ou nome, a classificação vale nos próximos recibos.'}
        </p>
        {similar.length > 0 ? (
          <div className={styles.list} aria-label="Fornecedores parecidos">
            <p className={styles.hint}>Encontramos cadastros parecidos. Vincule em vez de duplicar:</p>
            <ul className={styles.accountList}>
              {similar.map((item) => (
                <li key={item.id}>
                  <div className={styles.accountRow}>
                    <span>
                      {item.name}
                      {item.cnpj ? ` · ${item.cnpj}` : ''}
                      {item.matchReason === 'name' ? ' (nome)' : ' (CNPJ)'}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={action.busy}
                      onClick={() => void link(item.id)}
                    >
                      Usar este
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <label className={styles.searchLabel}>
          Buscar conta
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Nome ou número"
          />
        </label>
        <div className={styles.list} aria-label="Contas do plano">
          {categories.loading && !categories.data ? <Loading /> : null}
          <ErrorText message={categories.error ?? action.error ?? createAction.error} />
          {items.length === 0 && !categories.loading ? (
            <p className={styles.hint}>Nenhuma categoria encontrada. Cadastre uma abaixo.</p>
          ) : null}
          <ul className={styles.accountList}>
            {items.map((category: Category) => (
              <li key={category.id}>
                <label className={styles.accountRow}>
                  <input
                    type="radio"
                    name="receipt-category"
                    checked={selectedCode === category.code}
                    disabled={!category.code}
                    onChange={() => setSelectedCode(category.code ?? '')}
                  />
                  <span>
                    {category.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        {showCreate ? (
          <div className={styles.list} aria-label="Nova categoria">
            <p className={styles.hint}>Cadastre a categoria e o fornecedor fica lembrado nos próximos lançamentos.</p>
            <Field
              label="Nome da categoria"
              name="receiptNewCategory"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <Select
              label="Grupo pai"
              name="receiptNewParent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">Selecione</option>
              {(categories.data ?? [])
                .filter((c) => c.level === 'Group' || (c.level === 'Root' && c.section !== 'Asset' && c.section !== 'Liability'))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={createAction.busy} onClick={() => void createCategory()}>
                Criar categoria
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setShowCreate(true)}>
            Cadastrar categoria / fornecedor
          </Button>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={action.busy || !selectedCode}>
            Salvar classificação
          </Button>
        </div>
      </div>
    </div>
  )
}
