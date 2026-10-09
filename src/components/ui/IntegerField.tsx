import type { ReactNode } from 'react'
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
  maxLength?: number
}

/** Text integer input; digits only, no letters. */
export function IntegerField({
  label,
  name,
  value,
  onChange,
  required,
  disabled,
  hint,
  placeholder,
  maxLength,
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
      maxLength={maxLength}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
    />
  )
}
