import type { ReactNode, SelectHTMLAttributes } from 'react'
import styles from './Field.module.css'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
}

export function Select({ label, id, className, children, ...props }: Props) {
  const inputId = id ?? props.name
  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <label htmlFor={inputId}>{label}</label>
      </div>
      <select id={inputId} className={[styles.input, className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
    </div>
  )
}
