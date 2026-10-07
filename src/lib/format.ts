const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const moneyInputFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(value: number | null | undefined): string {
  return moneyFormatter.format(value ?? 0)
}

/** pt-BR amount with two decimals, without currency symbol (for inputs). */
export function formatMoneyInput(value: number | null | undefined): string {
  return moneyInputFormatter.format(value ?? 0)
}

/** Parses pt-BR user input ("1.234,56" or "1234.56") into a number; NaN when invalid. */
export function parseMoney(text: string): number {
  const trimmed = text.trim().replace(/\s/g, '').replace(/^R\$/, '')
  if (!trimmed) {
    return Number.NaN
  }
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed
  return Number(normalized)
}

export function formatPercent(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(1).replace('.', ',')}%`
}

/* ---------- Competence (yyyy-MM) ---------- */

export function currentCompetence(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function shiftCompetence(ym: string, delta: number): string {
  const [year, month] = ym.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatCompetence(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/* ---------- Dates ---------- */

export function todayInput(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Converts a yyyy-MM-dd input value into an ISO instant (noon UTC keeps the calendar day stable). */
export function dateToApi(date: string): string {
  return `${date}T12:00:00Z`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—'
  }
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—'
}

export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
