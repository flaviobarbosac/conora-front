import type { ReactNode } from 'react'
import { formatMoneyInput, parseMoney, sanitizeMoneyTyping } from '../../lib/format'
import { Field } from './Field'

type Props = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  hint?: ReactNode
  placeholder?: string
  className?: string
  /** Hide the visible label (keeps it for accessibility) and tighten spacing. */
  compact?: boolean
}

/** Text money input (pt-BR). Formats as the user types. Does not persist — caller saves via Salvar. */
export function MoneyField({
  label,
  name,
  value,
  onChange,
  required,
  disabled,
  hint,
  placeholder = '0,00',
  className,
  compact,
}: Props) {
  return (
    <Field
      label={label}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      hint={hint}
      className={className}
      compact={compact}
      value={value}
      onChange={(event) => onChange(sanitizeMoneyTyping(event.target.value))}
      onBlur={() => {
        if (!value.trim()) {
          return
        }
        const parsed = parseMoney(value)
        if (Number.isFinite(parsed)) {
          const next = formatMoneyInput(parsed)
          if (next !== value) {
            onChange(next)
          }
        }
      }}
    />
  )
}
