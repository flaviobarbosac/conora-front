import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './ui/Button'
import { IntegerField } from './ui/IntegerField'
import { MoneyField } from './ui/MoneyField'
import styles from './BudgetValueSheet.module.css'

type Props = {
  categoryName: string
  amount: string
  day: string | null
  /** Consultation only (life-project rateio): no edit, no confirm. */
  readOnly?: boolean
  hasPrev?: boolean
  hasNext?: boolean
  onConfirm: (amount: string, day: string | null) => void
  onPrev?: (amount: string, day: string | null) => void
  onNext?: (amount: string, day: string | null) => void
  onCancel: () => void
}

/** Full-screen edit sheet for budget amount (and due day) on narrow phones. */
export function BudgetValueSheet({
  categoryName,
  amount,
  day,
  readOnly = false,
  hasPrev = false,
  hasNext = false,
  onConfirm,
  onPrev,
  onNext,
  onCancel,
}: Props) {
  const titleId = useId()
  const [draftAmount, setDraftAmount] = useState(amount)
  const [draftDay, setDraftDay] = useState(day ?? '')
  const amountRef = useRef<HTMLInputElement>(null)
  const showDay = day !== null
  const showNav = (hasPrev && onPrev) || (hasNext && onNext)

  // Keep local drafts in sync when navigating categories or when server day arrives late.
  useEffect(() => {
    setDraftAmount(amount)
    setDraftDay(day ?? '')
  }, [amount, day])

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

  function resolvedDay(): string | null {
    return showDay ? draftDay : null
  }

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
          inputRef={readOnly ? undefined : amountRef}
          disabled={readOnly}
        />
        {showDay ? (
          <IntegerField
            label="Dia de vencimento"
            name="budget-sheet-day"
            placeholder="Dia"
            maxLength={2}
            value={draftDay}
            onChange={setDraftDay}
            disabled={readOnly}
          />
        ) : null}
        {readOnly ? (
          <p className={styles.readOnlyHint}>
            Valor do rateio do projeto de vida. Para alterar, edite o projeto — não o orçamento.
          </p>
        ) : null}
        {!readOnly && showNav ? (
          <div className={styles.nav} role="group" aria-label="Navegar categorias">
            <Button
              variant="ghost"
              type="button"
              disabled={!hasPrev || !onPrev}
              onClick={() => onPrev?.(draftAmount, resolvedDay())}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={!hasNext || !onNext}
              onClick={() => onNext?.(draftAmount, resolvedDay())}
            >
              Próxima
            </Button>
          </div>
        ) : null}
        <div className={styles.actions}>
          {readOnly ? (
            <Button type="button" onClick={onCancel}>
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="secondary" type="button" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => onConfirm(draftAmount, resolvedDay())}>
                Ok
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
