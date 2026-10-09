import type { ChartAccount, ChartSection } from '../api/finance'

/** Fixed root order: Receita, Desconto, Projetos, Essencial, Social, Ativo, Passivo. */
export const CHART_SECTION_ORDER: ChartSection[] = [
  'Income',
  'Discount',
  'LifeProject',
  'Essential',
  'Social',
  'Asset',
  'Liability',
]

/** Cash-flow roots shown in Raio-X and Home orçamento chart (excludes Asset/Liability). */
export const CASH_FLOW_SECTIONS: ChartSection[] = [
  'Income',
  'Discount',
  'LifeProject',
  'Essential',
  'Social',
]

export function isCashFlowSection(section: ChartSection): boolean {
  return CASH_FLOW_SECTIONS.includes(section)
}

function sectionRank(section: ChartSection): number {
  const index = CHART_SECTION_ORDER.indexOf(section)
  return index === -1 ? CHART_SECTION_ORDER.length : index
}

/** Roots stay in section order. Every other sibling is alphabetical (pt-BR). */
export function compareChartSiblings(a: ChartAccount, b: ChartAccount): number {
  if (a.level === 'Root' && b.level === 'Root') {
    return sectionRank(a.section) - sectionRank(b.section)
  }
  return a.name.localeCompare(b.name, 'pt-BR')
}

export function compareChartSections(a: ChartSection, b: ChartSection): number {
  return sectionRank(a) - sectionRank(b)
}
