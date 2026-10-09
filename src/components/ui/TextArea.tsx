import type { TextareaHTMLAttributes } from 'react'
import styles from './Field.module.css'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
}

export function TextArea({ label, id, className, ...props }: Props) {
  const inputId = id ?? props.name
  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <label htmlFor={inputId}>{label}</label>
      </div>
      <textarea id={inputId} className={[styles.input, styles.textarea, className].filter(Boolean).join(' ')} {...props} />
    </div>
  )
}
