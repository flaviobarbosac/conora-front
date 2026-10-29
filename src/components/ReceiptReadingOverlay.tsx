import type { ReactNode } from 'react'
import type { ReceiptPurpose } from '../api/finance'
import styles from './ReceiptReadingOverlay.module.css'

type Props = {
  open: boolean
  /** Destination the OCR settled on (or the page expectation while still reading). */
  purpose: ReceiptPurpose
  /** When OCR sent the photo to the other module. */
  rerouted?: boolean
  message?: ReactNode
}

export function WordLancamento() {
  return <span className={styles.wordExpense}>lançamento</span>
}

export function WordOrcamento() {
  return <span className={styles.wordBudget}>orçamento</span>
}

export function ReceiptReadingOverlay({ open, purpose, rerouted = false, message }: Props) {
  if (!open) return null

  const isBudget = purpose === 'BudgetBoleto'
  const destinationLabel = isBudget ? 'Orçamento' : 'Lançamento'
  const defaultMessage = (
    <>
      Identificando se é cupom (<WordLancamento />) ou boleto (<WordOrcamento />).
    </>
  )

  return (
    <div
      className={`${styles.overlay} ${isBudget ? styles.budget : styles.expense}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.card}>
        <p className={styles.kicker}>{rerouted ? 'Documento direcionado' : 'Lendo documento'}</p>
        <p className={styles.destination}>{destinationLabel}</p>
        <p className={styles.hint}>{message ?? defaultMessage}</p>
        <div className={styles.legend} aria-hidden="true">
          <span className={`${styles.chip} ${styles.chipBudget}`}>Orçamento</span>
          <span className={`${styles.chip} ${styles.chipExpense}`}>Lançamento</span>
        </div>
      </div>
    </div>
  )
}
