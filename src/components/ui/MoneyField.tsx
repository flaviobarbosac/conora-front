import type { ReactNode } from 'react'
import { formatMoneyInput, parseMoney, sanitizeMoneyTyping } from '../../lib/format'
import { Field } from './Field'

type Props = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  /** Called after blur formatting with the value that should be persisted. */
  onCommit?: (value: string) => void
  required?: boolean
  disabled?: boolean
  hint?: ReactNode
  placeholder?: string
  className?: string
  /** Hide the visible label (keeps it for accessibility) and tighten spacing. */
  compact?: boolean
}

/** Text money input (pt-BR), digits only, two decimals on blur. */
export function MoneyField({
  label,
  name,
  value,
  onChange,
  onCommit,
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
      inputMode="decimal"
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
        let next = value
        if (value.trim()) {
          const parsed = parseMoney(value)
          if (Number.isFinite(parsed)) {
            next = formatMoneyInput(parsed)
            onChange(next)
          }
        }
        onCommit?.(next)
      }}
    />
  )
}
