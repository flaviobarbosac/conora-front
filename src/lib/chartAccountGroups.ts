import type { ChartAccount } from '../api/finance'

export type ChartAccountGroup = {
  groupId: string
  groupName: string
  sortOrder: number
  items: ChartAccount[]
}

/** Groups analytical options under their synthetic (Group) parent. No account codes. */
export function groupChartAccounts(options: ChartAccount[], tree: ChartAccount[]): ChartAccountGroup[] {
  const byId = new Map(tree.map((account) => [account.id, account]))
  const groups = new Map<string, ChartAccountGroup>()

  for (const account of options) {
    const parent = account.parentId ? byId.get(account.parentId) : undefined
    const groupId = parent?.id ?? `section-${account.section}`
    const groupName = parent?.name ?? account.section
    const sortOrder = parent?.sortOrder ?? account.sortOrder
    const existing = groups.get(groupId)
    if (existing) {
      existing.items.push(account)
    } else {
      groups.set(groupId, { groupId, groupName, sortOrder, items: [account] })
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR')),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.groupName.localeCompare(b.groupName, 'pt-BR'))
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
        : group.items.filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(normalized))
      return items.length > 0 ? { ...group, items } : null
    })
    .filter((group): group is ChartAccountGroup => group !== null)
}
