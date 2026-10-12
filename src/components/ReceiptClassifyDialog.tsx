import { useEffect, useId, useMemo, useState } from 'react'
import { receiptsApi, type Category, type ReceiptIntake } from '../api/finance'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { Button } from './ui/Button'
import { ErrorText, Loading } from './ui/Feedback'
import styles from './IanAnalyzeDialog.module.css'

type Props = {
  open: boolean
  intake: ReceiptIntake | null
  onClose: () => void
  onClassified: (intake: ReceiptIntake) => void
}

export function ReceiptClassifyDialog({ open, intake, onClose, onClassified }: Props) {
  const titleId = useId()
  const action = useAction()
  const categories = useLoad(() => receiptsApi.categories(), [])
  const [filter, setFilter] = useState('')
  const [selectedCode, setSelectedCode] = useState('')

  useEffect(() => {
    if (!open) return
    setFilter('')
    setSelectedCode(intake?.proposedCategoryCode ?? '')
  }, [open, intake?.proposedCategoryCode])

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

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Classificar fornecedor
          </h2>
          <button type="button" className={styles.close} aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>
        <p className={styles.hint}>
          {intake.extractedName
            ? `Fornecedor: ${intake.extractedName}${intake.extractedCnpj ? ` (CNPJ ${intake.extractedCnpj})` : ''}.`
            : 'Escolha a conta do plano. Com CNPJ, a classificação vale para todos os usuários.'}
        </p>
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
          <ErrorText message={categories.error ?? action.error} />
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
                    {category.displayNumber ? `${category.displayNumber} · ` : ''}
                    {category.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
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
