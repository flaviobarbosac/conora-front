export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function isEmail(value: string): boolean {
  return value.includes('@')
}

export function formatCpfInput(value: string): string {
  const digits = digitsOnly(value).slice(0, 11)
  if (digits.length <= 3) {
    return digits
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function formatLoginUsuario(value: string): string {
  if (isEmail(value) || value.includes('@')) {
    return value
  }
  return formatCpfInput(value)
}
