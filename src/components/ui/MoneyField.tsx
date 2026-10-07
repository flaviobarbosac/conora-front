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
}

/** Text money input (pt-BR), digits only, two decimals on blur. */
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
      value={value}
      onChange={(event) => onChange(sanitizeMoneyTyping(event.target.value))}
      onBlur={() => {
        if (!value.trim()) {
          return
        }
        const parsed = parseMoney(value)
        if (Number.isFinite(parsed)) {
          onChange(formatMoneyInput(parsed))
        }
      }}
    />
  )
}
