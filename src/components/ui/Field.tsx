import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './Field.module.css'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  /** Hide the visible label (keeps it for accessibility) and tighten spacing. */
  compact?: boolean
}

export function Field({ label, hint, id, className, compact, ...props }: Props) {
  const inputId = id ?? props.name
  return (
    <div className={[styles.field, compact ? styles.compact : ''].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <label htmlFor={inputId}>{label}</label>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </div>
      <input id={inputId} className={[styles.input, className].filter(Boolean).join(' ')} {...props} />
    </div>
  )
}
