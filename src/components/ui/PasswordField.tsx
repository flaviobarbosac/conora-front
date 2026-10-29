import { useId, useState, type InputHTMLAttributes } from 'react'
import fieldStyles from './Field.module.css'
import styles from './PasswordField.module.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  hint?: string
}

/** Password input with show/hide toggle for auth screens. */
export function PasswordField({ label, hint, id, name, className, ...props }: Props) {
  const autoId = useId()
  const inputId = id ?? name ?? autoId
  const [visible, setVisible] = useState(false)

  return (
    <div className={fieldStyles.field}>
      <div className={fieldStyles.header}>
        <label htmlFor={inputId}>{label}</label>
      </div>
      {hint ? <p className={fieldStyles.hint}>{hint}</p> : null}
      <div className={styles.wrap}>
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          className={[fieldStyles.input, styles.input, className].filter(Boolean).join(' ')}
          {...props}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </div>
  )
}
