import type { Category, CategorySection } from '../api/finance'
import { categoryLabel } from './categoryLabel'
import { compareCategorySections, sectionLabel } from './categoryOrder'

export type CategoryGroup = {
  groupId: string
  groupName: string
  section: CategorySection
  /** Plain name used only to keep subgroups alphabetical, ignoring the display number. */
  sortName: string
  items: Category[]
}

/**
 * Groups analytical options under their synthetic (Group) parent.
 * Group/Root accounts passed in `options` appear as selectable items under their section label
 * (used by the Conta filter: Orçamento, Receita, Despesa…).
 */
export function groupCategories(options: Category[], tree: Category[]): CategoryGroup[] {
  const byId = new Map(tree.map((account) => [account.id, account]))
  const groups = new Map<string, CategoryGroup>()

  for (const account of options) {
    if (account.level !== 'Analytical') {
      const groupId = `filter-${account.section}-${account.id}`
      const groupName = sectionLabel(account.section)
      const existing = groups.get(groupId)
      if (existing) {
        existing.items.push(account)
      } else {
        groups.set(groupId, {
          groupId,
          groupName,
          section: account.section,
          sortName: account.name,
          items: [account],
        })
      }
      continue
    }

    const parent = account.parentId ? byId.get(account.parentId) : undefined
    const groupId = parent?.id ?? `section-${account.section}`
    const groupName = parent ? categoryLabel(parent) : sectionLabel(account.section)
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
        compareCategorySections(a.section, b.section) || a.sortName.localeCompare(b.sortName, 'pt-BR'),
    )
}

export function filterCategoryGroups(groups: CategoryGroup[], query: string): CategoryGroup[] {
  const normalized = query.trim().toLocaleLowerCase('pt-BR')
  if (!normalized) {
    return groups
  }

  return groups
    .map((group) => {
      const groupMatch = group.groupName.toLocaleLowerCase('pt-BR').includes(normalized)
      const items = groupMatch
        ? group.items
        : group.items.filter((item) => categoryLabel(item).toLocaleLowerCase('pt-BR').includes(normalized))
      return items.length > 0 ? { ...group, items } : null
    })
    .filter((group): group is CategoryGroup => group !== null)
}
