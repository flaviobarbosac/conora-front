import { useMemo } from 'react'
import { accountsApi, categoriesApi, type Account, type Category } from '../api/finance'
import { useLoad } from './useLoad'

/** Accounts and categories used by selects and by id → name lookups. */
export function useLookups() {
  const accounts = useLoad(() => accountsApi.list(), [])
  const categories = useLoad(() => categoriesApi.list(), [])

  const accountName = useMemo(() => {
    const map = new Map<string, string>()
    accounts.data?.forEach((account: Account) => map.set(account.id, account.name))
    return (id: string | null) => (id ? (map.get(id) ?? '—') : '—')
  }, [accounts.data])

  const categoryName = useMemo(() => {
    const map = new Map<string, string>()
    categories.data?.forEach((category: Category) => map.set(category.id, category.name))
    return (id: string | null) => (id ? (map.get(id) ?? '—') : 'Sem categoria')
  }, [categories.data])

  return {
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    accountName,
    categoryName,
    reloadAccounts: accounts.reload,
    loading: accounts.loading || categories.loading,
  }
}
