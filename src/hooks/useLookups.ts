import { useMemo } from 'react'
import { accountsApi, chartAccountsApi, type Account, type ChartAccount, type ChartSection } from '../api/finance'
import { chartAccountLabel } from '../lib/chartLabel'
import { CASH_FLOW_SECTIONS } from '../lib/chartOrder'
import { useLoad } from './useLoad'

const PATRIMONY_SECTIONS: ChartSection[] = ['Asset', 'Liability']

/** Bank accounts and chart accounts used by selects and by id → name lookups. */
export function useLookups() {
  const accounts = useLoad(() => accountsApi.list(), [])
  const chartAccounts = useLoad(() => chartAccountsApi.list(undefined, false, false), [])

  const accountName = useMemo(() => {
    const map = new Map<string, string>()
    accounts.data?.forEach((account: Account) => map.set(account.id, account.name))
    return (id: string | null) => (id ? (map.get(id) ?? '—') : '—')
  }, [accounts.data])

  const chartAccountName = useMemo(() => {
    const map = new Map<string, string>()
      chartAccounts.data?.forEach((account: ChartAccount) => map.set(account.id, chartAccountLabel(account)))
    return (id: string | null) => (id ? (map.get(id) ?? '—') : 'Sem conta')
  }, [chartAccounts.data])

  const analytical = useMemo(
    () => (chartAccounts.data ?? []).filter((account) => account.level === 'Analytical' && account.isActive),
    [chartAccounts.data],
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
    chartAccounts: chartAccounts.data ?? [],
    categories: cashFlowAccounts,
    cashFlowAccounts,
    expenseAccounts,
    incomeAccounts,
    patrimonyAccounts,
    accountName,
    categoryName: chartAccountName,
    chartAccountName,
    reloadAccounts: accounts.reload,
    reloadChartAccounts: chartAccounts.reload,
    loading: accounts.loading || chartAccounts.loading,
  }
}
