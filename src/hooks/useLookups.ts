import { useMemo } from 'react'
import { accountsApi, categoriesApi, type Account, type Category, type CategorySection } from '../api/finance'
import { categoryLabel } from '../lib/categoryLabel'
import { CASH_FLOW_SECTIONS } from '../lib/categoryOrder'
import { useLoad } from './useLoad'

const PATRIMONY_SECTIONS: CategorySection[] = ['Asset', 'Liability']

/** Bank accounts and categories used by selects and by id → name lookups. */
export function useLookups() {
  const accounts = useLoad(() => accountsApi.list(), [])
  const categories = useLoad(() => categoriesApi.list(undefined, false, false), [])

  const accountName = useMemo(() => {
    const map = new Map<string, string>()
    accounts.data?.forEach((account: Account) => map.set(account.id, account.name))
    return (id: string | null) => (id ? (map.get(id) ?? '—') : '—')
  }, [accounts.data])

  const categoryName = useMemo(() => {
    const map = new Map<string, string>()
      categories.data?.forEach((account: Category) => map.set(account.id, categoryLabel(account)))
    return (id: string | null) => (id ? (map.get(id) ?? '—') : 'Sem conta')
  }, [categories.data])

  const analytical = useMemo(
    () => (categories.data ?? []).filter((account) => account.level === 'Analytical' && account.isActive),
    [categories.data],
  )

  const cashFlowAccounts = useMemo(
    () => analytical.filter((account) => CASH_FLOW_SECTIONS.includes(account.section)),
    [analytical],
  )

  const expenseAccounts = useMemo(
    () =>
      analytical.filter((account) =>
        ['Discount', 'LifeProject', 'Essential', 'Social'].includes(account.section),
      ),
    [analytical],
  )

  const incomeAccounts = useMemo(
    () => analytical.filter((account) => account.section === 'Income'),
    [analytical],
  )

  const patrimonyAccounts = useMemo(
    () => analytical.filter((account) => PATRIMONY_SECTIONS.includes(account.section)),
    [analytical],
  )

  return {
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    cashFlowAccounts,
    expenseAccounts,
    incomeAccounts,
    patrimonyAccounts,
    accountName,
    categoryName,
    reloadAccounts: accounts.reload,
    reloadCategories: categories.reload,
    loading: accounts.loading || categories.loading,
  }
}
