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

/**
 * Live pt-BR money mask while typing (cents from the right).
 * Caps at 99.999.999,99 (10 digits). Empty input stays empty.
 */
export function sanitizeMoneyTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (!digits) {
    return ''
  }
  return formatMoneyInput(Number(digits) / 100)
}

export function formatPercent(value: number | null | undefined): string {
  return `${(value ?? 0).toFixed(1).replace('.', ',')}%`
}

/** Brazil wall clock (UTC−3; no DST). Used for display and “today” in the app. */
export const BRAZIL_TIME_ZONE = 'America/Sao_Paulo'

/** yyyy-MM-dd in America/Sao_Paulo. */
function brazilDateParts(now = new Date()): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BRAZIL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return { year, month, day }
}

/* ---------- Competence (yyyy-MM) ---------- */

export function currentCompetence(): string {
  const { year, month } = brazilDateParts()
  return `${year}-${month}`
}

export function shiftCompetence(ym: string, delta: number): string {
  const [year, month] = ym.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Lists N competences starting at startYm (inclusive). */
export function competencesFrom(startYm: string, count: number): string[] {
  if (count <= 0) {
    return []
  }
  const list: string[] = []
  for (let i = 0; i < count; i++) {
    list.push(shiftCompetence(startYm, i))
  }
  return list
}

export function monthsInclusive(fromYm: string, toYm: string): string[] {
  if (!fromYm || !toYm || fromYm > toYm) {
    return []
  }
  const months: string[] = []
  let current = fromYm
  while (current <= toYm) {
    months.push(current)
    current = shiftCompetence(current, 1)
  }
  return months
}

export function formatCompetence(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/* ---------- Dates ---------- */

export function todayInput(): string {
  const { year, month, day } = brazilDateParts()
  return `${year}-${month}-${day}`
}

/** Converts a yyyy-MM-dd input value into an ISO instant (noon UTC keeps the calendar day stable). */
export function dateToApi(date: string): string {
  return `${date}T12:00:00Z`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—'
  }
  // Calendar-only values (and our noon-UTC date convention) keep the written day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) || /^\d{4}-\d{2}-\d{2}T12:00:00(\.000)?Z$/.test(iso)) {
    const [year, month, day] = iso.slice(0, 10).split('-')
    return `${day}/${month}/${year}`
  }
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: BRAZIL_TIME_ZONE })
}

/** Instant → Brazil local date/time (UTC−3). */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: BRAZIL_TIME_ZONE }) : '—'
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
