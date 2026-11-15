/** Exact cent arithmetic. Screen and API amounts are compared in cents, never with binary floats. */

export function cents(value: number): bigint {
  const negative = Object.is(value, -0) || value < 0
  const text = Math.abs(value).toFixed(2)
  const [whole, frac] = text.split('.')
  const amount = BigInt(whole) * 100n + BigInt(frac)
  return negative ? -amount : amount
}

export function formatCents(amount: bigint): string {
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  const whole = abs / 100n
  const frac = (abs % 100n).toString().padStart(2, '0')
  const digits = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : ''}R$ ${digits},${frac}`
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export type BudgetLine = {
  categoryId: string | null
  parentId: string | null
  categoryName: string
  plannedAmount: number
  actualAmount: number
  isGroup: boolean
}

export type BudgetSection = {
  name: string
  plannedAmount: number
  actualAmount: number
  lines: BudgetLine[]
}

export type BudgetPayload = {
  competenceYm: string
  totalPlanned: number
  totalActual: number
  monthResult: number
  sections: BudgetSection[]
  lines: BudgetLine[]
}

const COUNTING = new Set(['Income', 'Expense', 'Contribution', 'ProjectContribution'])

export function sectionProblems(budget: BudgetPayload): string[] {
  const problems: string[] = []
  for (const section of budget.sections) {
    let planned = 0n
    let actual = 0n
    for (const line of section.lines) {
      planned += cents(line.plannedAmount)
      actual += cents(line.actualAmount)
    }
    if (planned !== cents(section.plannedAmount)) {
      problems.push(
        `${section.name}: planejado da seção ${formatCents(cents(section.plannedAmount))} não é a soma das linhas ${formatCents(planned)}`,
      )
    }
    if (actual !== cents(section.actualAmount)) {
      problems.push(
        `${section.name}: realizado da seção ${formatCents(cents(section.actualAmount))} não é a soma das linhas ${formatCents(actual)}`,
      )
    }
  }
  return problems
}

export type CategoryNode = { id: string; parentId: string | null; name: string; level: string }

export type RootRollup = { name: string; planned: bigint; actual: bigint }

function absCents(amount: bigint): bigint {
  return amount < 0n ? -amount : amount
}

/** Same rollup as the screen: leaves roll into the root, and the parent shows the absolute sum. */
export function rootRollups(lines: BudgetLine[], categories: CategoryNode[]): RootRollup[] {
  const planned = new Map<string, bigint>()
  const actual = new Map<string, bigint>()
  for (const line of lines) {
    if (!line.categoryId) continue
    planned.set(line.categoryId, cents(line.plannedAmount))
    actual.set(line.categoryId, cents(line.actualAmount))
  }
  const byParent = new Map<string, CategoryNode[]>()
  for (const category of categories) {
    if (!category.parentId) continue
    const children = byParent.get(category.parentId) ?? []
    children.push(category)
    byParent.set(category.parentId, children)
  }
  const roll = (id: string): { planned: bigint; actual: bigint } => {
    const children = byParent.get(id) ?? []
    if (children.length === 0) {
      return {
        planned: absCents(planned.get(id) ?? 0n),
        actual: absCents(actual.get(id) ?? 0n),
      }
    }
    let plannedTotal = 0n
    let actualTotal = 0n
    for (const child of children) {
      const totals = roll(child.id)
      plannedTotal += totals.planned
      actualTotal += totals.actual
    }
    return { planned: plannedTotal, actual: actualTotal }
  }
  return categories
    .filter((category) => category.level === 'Root')
    .map((category) => ({ name: category.name, ...roll(category.id) }))
    .filter((row) => row.planned !== 0n || row.actual !== 0n)
}

export function numberFromCents(amount: bigint): number {
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  return Number(`${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`)
}

export type EntryRow = {
  id: string
  type: string
  amount: number
  categoryId: string | null
  description: string
  competenceYm: string
}

export function entrySensitization(lines: BudgetLine[], entries: EntryRow[]): string[] {
  const byCategory = new Map<string, bigint>()
  for (const entry of entries) {
    if (!entry.categoryId || !COUNTING.has(entry.type)) continue
    byCategory.set(entry.categoryId, (byCategory.get(entry.categoryId) ?? 0n) + cents(entry.amount))
  }

  const problems: string[] = []
  for (const [categoryId, sum] of byCategory) {
    const line = lines.find((item) => item.categoryId === categoryId)
    if (!line) {
      problems.push(`lançamento na conta ${categoryId} não apareceu no orçamento`)
      continue
    }
    const actual = cents(line.actualAmount)
    if (sum !== actual) {
      problems.push(
        `${line.categoryName}: lançamentos somam ${formatCents(sum)} e o realizado está ${formatCents(actual)}`,
      )
    }
  }
  return problems
}
