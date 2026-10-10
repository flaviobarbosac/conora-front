import type { Category, CategorySection } from '../api/finance'

/** Display order for section ranking (masters + posting sections). */
export const CATEGORY_SECTION_ORDER: CategorySection[] = [
  'Budget',
  'Income',
  'Expense',
  'Discount',
  'LifeProject',
  'Essential',
  'Social',
  'Patrimony',
  'Asset',
  'Liability',
]

/** Cash-flow posting sections (under Orçamento). */
export const CASH_FLOW_SECTIONS: CategorySection[] = [
  'Income',
  'Discount',
  'LifeProject',
  'Essential',
  'Social',
]

/** Expense posting sections under Despesa. */
export const EXPENSE_SECTIONS: CategorySection[] = [
  'Discount',
  'LifeProject',
  'Essential',
  'Social',
]

export const PATRIMONY_SECTIONS: CategorySection[] = ['Asset', 'Liability']

export const STRUCTURAL_SECTIONS: CategorySection[] = ['Budget', 'Expense', 'Patrimony']

export function isCashFlowSection(section: CategorySection): boolean {
  return CASH_FLOW_SECTIONS.includes(section)
}

export function isPatrimonySection(section: CategorySection): boolean {
  return PATRIMONY_SECTIONS.includes(section)
}

export function isStructuralSection(section: CategorySection): boolean {
  return STRUCTURAL_SECTIONS.includes(section)
}

/** Parents that may receive a new analytical account. */
export function acceptsAnalyticalChild(section: CategorySection): boolean {
  return isCashFlowSection(section) || isPatrimonySection(section)
}

function sectionRank(section: CategorySection): number {
  const index = CATEGORY_SECTION_ORDER.indexOf(section)
  return index === -1 ? CATEGORY_SECTION_ORDER.length : index
}

/** Roots stay in section order. Every other sibling is alphabetical (pt-BR). */
export function compareCategorySiblings(a: Category, b: Category): number {
  if (a.level === 'Root' && b.level === 'Root') {
    return sectionRank(a.section) - sectionRank(b.section)
  }
  return a.name.localeCompare(b.name, 'pt-BR')
}

export function compareCategorySections(a: CategorySection, b: CategorySection): number {
  return sectionRank(a) - sectionRank(b)
}

export function sectionLabel(section: CategorySection): string {
  switch (section) {
    case 'Budget':
      return 'Orçamento'
    case 'Expense':
      return 'Despesa'
    case 'Patrimony':
      return 'Patrimônio'
    case 'Income':
      return 'Receita'
    case 'Discount':
      return 'Descontos'
    case 'LifeProject':
      return 'Projeto de vida'
    case 'Essential':
      return 'Essencial'
    case 'Social':
      return 'Social'
    case 'Asset':
      return 'Ativo'
    case 'Liability':
      return 'Passivo'
    default:
      return section
  }
}
