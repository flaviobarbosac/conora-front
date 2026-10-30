import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui/Button'
import styles from './ConfirmDialog.module.css'

export type ScanPurposeChoice = 'boleto' | 'contracheque' | 'cupom'

type Props = {
  open: boolean
  title?: string
  /** When true, includes cupom (lançamento) as a third option. */
  includeCupom?: boolean
  onClose: () => void
  onChoose: (choice: ScanPurposeChoice) => void
}

/** Before camera: pick boleto, payslip/income, or expense receipt. */
export function ScanPurposeSheet({
  open,
  title = 'O que você vai fotografar?',
  includeCupom = false,
  onClose,
  onChoose,
}: Props) {
  const titleId = useId()
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    firstRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>Escolha o destino da foto. Contracheque grava renda; boleto entra no orçamento.</p>
        <div className={styles.actions} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <Button
            ref={firstRef}
            variant="secondary"
            onClick={() => {
              onChoose('boleto')
              onClose()
            }}
          >
            Boleto (água, luz, etc.)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onChoose('contracheque')
              onClose()
            }}
          >
            Contracheque / renda
          </Button>
          {includeCupom ? (
            <Button
              variant="secondary"
              onClick={() => {
                onChoose('cupom')
                onClose()
              }}
            >
              Cupom / comprovante pago
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
