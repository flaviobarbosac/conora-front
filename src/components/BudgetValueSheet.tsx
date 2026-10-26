import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { IntegerField } from './ui/IntegerField'
import { MoneyField } from './ui/MoneyField'
import styles from './BudgetValueSheet.module.css'

type Props = {
  categoryName: string
  amount: string
  day: string | null
  onConfirm: (amount: string, day: string | null) => void
  onCancel: () => void
}

/** Full-screen edit sheet for budget amount (and due day) on narrow phones. */
export function BudgetValueSheet({ categoryName, amount, day, onConfirm, onCancel }: Props) {
  const titleId = useId()
  const [draftAmount, setDraftAmount] = useState(amount)
  const [draftDay, setDraftDay] = useState(day ?? '')
  const amountRef = useRef<HTMLInputElement>(null)
  const showDay = day !== null

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => amountRef.current?.focus(), 50)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [onCancel])

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          {categoryName}
        </h2>
        <MoneyField
          label="Valor (R$)"
          name="budget-sheet-amount"
          value={draftAmount}
          onChange={setDraftAmount}
          inputRef={amountRef}
        />
        {showDay ? (
          <IntegerField
            label="Dia de vencimento"
            name="budget-sheet-day"
            placeholder="Dia"
            maxLength={2}
            value={draftDay}
            onChange={setDraftDay}
          />
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(draftAmount, showDay ? draftDay : null)}
          >
            Ok
          </Button>
        </div>
      </div>
    </div>
  )
}
