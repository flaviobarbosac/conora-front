import type { ChartAccount, ChartSection } from '../api/finance'
import { chartAccountLabel } from './chartLabel'
import { compareChartSections } from './chartOrder'

export type ChartAccountGroup = {
  groupId: string
  groupName: string
  section: ChartSection
  /** Plain name used only to keep subgroups alphabetical, ignoring the display number. */
  sortName: string
  items: ChartAccount[]
}

/** Groups analytical options under their synthetic (Group) parent. No account codes. */
export function groupChartAccounts(options: ChartAccount[], tree: ChartAccount[]): ChartAccountGroup[] {
  const byId = new Map(tree.map((account) => [account.id, account]))
  const groups = new Map<string, ChartAccountGroup>()

  for (const account of options) {
    const parent = account.parentId ? byId.get(account.parentId) : undefined
    const groupId = parent?.id ?? `section-${account.section}`
    const groupName = parent ? chartAccountLabel(parent) : account.section
    const existing = groups.get(groupId)
    if (existing) {
      existing.items.push(account)
    } else {
      groups.set(groupId, {
        groupId,
        groupName,
        section: account.section,
        sortName: parent?.name ?? account.name,
        items: [account],
      })
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    }))
    .sort(
      (a, b) =>
        compareChartSections(a.section, b.section) || a.sortName.localeCompare(b.sortName, 'pt-BR'),
    )
}

export function filterChartAccountGroups(groups: ChartAccountGroup[], query: string): ChartAccountGroup[] {
  const normalized = query.trim().toLocaleLowerCase('pt-BR')
  if (!normalized) {
    return groups
  }

  return groups
    .map((group) => {
      const groupMatch = group.groupName.toLocaleLowerCase('pt-BR').includes(normalized)
      const items = groupMatch
        ? group.items
        : group.items.filter((item) => chartAccountLabel(item).toLocaleLowerCase('pt-BR').includes(normalized))
      return items.length > 0 ? { ...group, items } : null
    })
    .filter((group): group is ChartAccountGroup => group !== null)
}
