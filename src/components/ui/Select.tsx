import type { ReactNode, SelectHTMLAttributes } from 'react'
import styles from './Field.module.css'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
  /** Hide the visible label (keeps it for accessibility) and tighten spacing. */
  compact?: boolean
}

export function Select({ label, id, className, compact, children, ...props }: Props) {
  const inputId = id ?? props.name
  return (
    <div className={[styles.field, compact ? styles.compact : ''].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <label htmlFor={inputId}>{label}</label>
      </div>
      <select id={inputId} className={[styles.input, className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
    </div>
  )
}
