import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './CheckboxField.module.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  /** Visible explanation beside the checkbox (what on/off means). */
  description: ReactNode
}

/** Boolean preference control — use instead of a select for on/off settings. */
export function CheckboxField({ label, description, id, name, className, ...props }: Props) {
  const inputId = id ?? name
  return (
    <label className={[styles.field, className].filter(Boolean).join(' ')} htmlFor={inputId}>
      <input id={inputId} name={name} type="checkbox" className={styles.input} {...props} />
      <span className={styles.copy}>
        <span className={styles.label}>{label}</span>
        <span className={styles.description}>{description}</span>
      </span>
    </label>
  )
}
