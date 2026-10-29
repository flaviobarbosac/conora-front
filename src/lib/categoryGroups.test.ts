import { describe, expect, it } from 'vitest'
import type { Category } from '../api/finance'
import { filterCategoryGroups, groupCategories } from './categoryGroups'

function cat(partial: Partial<Category> & Pick<Category, 'id' | 'name' | 'level' | 'section'>): Category {
  return {
    code: null,
    parentId: null,
    isSystem: false,
    isActive: true,
    sortOrder: 0,
    displayNumber: null,
    ...partial,
  } as Category
}

describe('categoryGroups', () => {
  const parent = cat({ id: 'p1', name: 'Essencial', level: 'Group', section: 'Essential' })
  const childA = cat({
    id: 'c1',
    name: 'Aluguel',
    level: 'Analytical',
    section: 'Essential',
    parentId: 'p1',
  })
  const childB = cat({
    id: 'c2',
    name: 'Água',
    level: 'Analytical',
    section: 'Essential',
    parentId: 'p1',
  })
  const tree = [parent, childA, childB]

  it('groups analytical under parent', () => {
    const groups = groupCategories([childA, childB], tree)
    expect(groups).toHaveLength(1)
    expect(groups[0].groupName).toBe('Essencial')
    expect(groups[0].items.map((i) => i.name).sort()).toEqual(['Aluguel', 'Água'].sort())
  })

  it('keeps non-analytical as filter buckets', () => {
    const groups = groupCategories([parent], tree)
    expect(groups[0].groupId).toContain('filter-')
    expect(groups[0].items).toHaveLength(1)
  })

  it('filters by query on group or item', () => {
    const groups = groupCategories([childA, childB], tree)
    expect(filterCategoryGroups(groups, '')).toEqual(groups)
    expect(filterCategoryGroups(groups, 'água')[0].items).toHaveLength(1)
    expect(filterCategoryGroups(groups, 'essencial')[0].items).toHaveLength(2)
    expect(filterCategoryGroups(groups, 'zzzz')).toHaveLength(0)
  })
})
