import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { entryDisplayDescription, type Category, type Entry } from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { SharingViewToggle } from '../components/SharingViewToggle'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useRaioXPageController } from '../hooks/useRaioXPageController'
import { FREE_TIER_CATEGORY_LABEL, isFreeCategoryCode } from '../lib/freeTier'
import {
  focusSections,
  sectionHead,
  sectionPlannedActual,
  sumBranch,
  type RaioXFocus,
} from '../lib/raioX'
import { saveRaioXReturn } from '../lib/raioXReturn'
import pageStyles from './pageStyles'
import {
  RaioXAnchorsNav,
  RaioXNoLeakageCelebrate,
  RaioXPeriodLeakageControls,
  RaioXTreeList,
  buildTreeMenuItems,
} from './raioX/RaioXPagePanels'
import raioStyles from './raioX/raioX.module.css'
import {
  MONTHS_MIN,
  RaioXHero,
  RaioXSideCards,
  ancestorIds,
  sumYearField,
  sumYearSection,
} from './raioX/raioXShared'

const styles = { ...pageStyles, ...raioStyles }

export function RaioXPage() {
  const navigate = useNavigate()
  const {
    freeLimited,
    fullAccess,
    ym,
    setYm,
    months,
    setMonths,
    focus,
    setFocus,
    open,
    setOpen,
    scope,
    setScope,
    leakageOnly,
    setLeakageOnly,
    treeMenuOpen,
    setTreeMenuOpen,
    monthList,
    budget,
    yearsBudget,
    previousCash,
    accounts,
    entries,
    planned,
    actual,
    list,
    byParent,
    rootRows,
    hasLeakage,
    categoryNameById,
    bankNameById,
    entriesByAccount,
    projects,
  } = useRaioXPageController()

  function toggle(id: string) {
    setFocus(null)
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleFocus(next: RaioXFocus) {
    setFocus((current) => (current === next ? null : next))
  }

  function clearFocus() {
    setFocus(null)
    setTreeMenuOpen(false)
  }

  function jumpToTreeAccount(accountId: string) {
    setTreeMenuOpen(false)
    setFocus(null)
    const ancestors = ancestorIds(accountId, list)
    setOpen((current) => {
      const next = new Set(current)
      next.add(accountId)
      for (const id of ancestors) {
        next.add(id)
      }
      return next
    })
    window.setTimeout(() => {
      const target =
        document.getElementById(`raiox-account-${accountId}`) ??
        [...ancestors]
          .reverse()
          .map((id) => document.getElementById(`raiox-account-${id}`))
          .find(Boolean) ??
        document.getElementById('raiox-arvore')
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 60)
  }

  function openBudgetForAccount(accountId: string) {
    const returnPath = raioXReturnPath()
    const openWithAncestors = new Set(open)
    openWithAncestors.add(accountId)
    for (const id of ancestorIds(accountId, list)) {
      openWithAncestors.add(id)
    }
    saveRaioXReturn({
      path: returnPath,
      scrollY: window.scrollY,
      openIds: [...openWithAncestors],
      competenceYm: ym,
      months,
      leakageOnly,
      categoryId: accountId,
    })
    const params = new URLSearchParams({
      competenceYm: ym,
      categoryId: accountId,
      returnTo: returnPath,
    })
    navigate(`/orcamento?${params.toString()}`)
  }

  function categoryUnlocked(account: Category): boolean {
    if (fullAccess) return true
    if (account.level !== 'Analytical') {
      return true
    }
    return isFreeCategoryCode(account.code)
  }

  function raioXReturnPath() {
    const returnParams = new URLSearchParams({ competenceYm: ym })
    if (months > MONTHS_MIN) {
      returnParams.set('months', String(months))
    }
    return `/raio-x?${returnParams.toString()}`
  }

  function openBusca(filters: {
    competenceYm?: string
    search?: string
    categoryId?: string
    type?: string
  }) {
    const returnPath = raioXReturnPath()
    const openWithAncestors = new Set(open)
    if (filters.categoryId) {
      openWithAncestors.add(filters.categoryId)
      for (const id of ancestorIds(filters.categoryId, list)) {
        openWithAncestors.add(id)
      }
    }
    saveRaioXReturn({
      path: returnPath,
      scrollY: window.scrollY,
      openIds: [...openWithAncestors],
      competenceYm: ym,
      months,
      leakageOnly,
      categoryId: filters.categoryId,
    })
    const params = new URLSearchParams({
      competenceYm: filters.competenceYm || ym,
      returnTo: returnPath,
    })
    if (filters.search?.trim()) {
      params.set('search', filters.search.trim())
    }
    if (filters.categoryId) {
      params.set('categoryId', filters.categoryId)
    }
    if (filters.type) {
      params.set('type', filters.type)
    }
    navigate(`/lancamentos/busca?${params.toString()}`)
  }

  function openEntry(entry: Entry) {
    // From Raio-X: always open busca filtered by the clicked launch — never the edit form.
    // Includes ProjectContribution (projeto de vida).
    const search = entryDisplayDescription(entry).trim()
    openBusca({
      competenceYm: entry.competenceYm || ym,
      search: search || undefined,
      categoryId: entry.categoryId ?? undefined,
      type: entry.type === 'Expense' || entry.type === 'Income' ? entry.type : undefined,
    })
  }

  function openActualForAccount(account: Category, launchEntries: Entry[]) {
    if (!categoryUnlocked(account)) return
    if (launchEntries.length === 1) {
      openEntry(launchEntries[0])
      return
    }
    if (launchEntries.length > 1) {
      openBusca({ categoryId: account.id })
      return
    }
    if (account.section === 'LifeProject' && account.level === 'Analytical') {
      openBusca({ categoryId: account.id, search: account.name })
      return
    }
    setOpen((prev) => new Set(prev).add(account.id))
  }

  const data = budget.data
  const highlighted = focusSections(focus)
  const loadingRange = months > 1 && yearsBudget.loading && !yearsBudget.data
  const rangeIncome = sumYearField(yearsBudget.data ?? [], monthList, 'receivedIncome')
  const rangeBalance = sumYearField(yearsBudget.data ?? [], monthList, 'monthResult')
  const incomeActual = months === 1 ? Math.abs(data?.receivedIncome ?? 0) : rangeIncome
  const discountMonth =
    months === 1 && data ? sectionPlannedActual(data, 'Discount') : null
  // Display: planned when nothing realized yet. Gastável must NOT subtract planned (renda líquida).
  const discountDisplay =
    discountMonth != null
      ? discountMonth.actual > 0.001
        ? discountMonth.actual
        : discountMonth.planned
      : sumYearSection(yearsBudget.data ?? [], monthList, 'Discount')
  const discountForSpendable = discountMonth?.actual ?? 0
  const discountIsPlannedOnly =
    discountMonth != null && discountMonth.actual <= 0.001 && discountMonth.planned > 0.001
  const monthBalance = months === 1 ? (data?.monthResult ?? 0) : rangeBalance

  const treeMenuItems = useMemo(
    () => buildTreeMenuItems(rootRows, byParent),
    [rootRows, byParent],
  )

  return (
    <div className={`${styles.page} ${styles.raioxPage}`} onClick={clearFocus}>
      <RaioXAnchorsNav
        treeMenuOpen={treeMenuOpen}
        treeMenuItems={treeMenuItems}
        setTreeMenuOpen={setTreeMenuOpen}
        onJump={jumpToTreeAccount}
      />
      <PageHeader
        title="Raio-X"
        actions={
          <>
            <SharingViewToggle onChange={setScope} />
            <CompetencePicker value={ym} onChange={setYm} />
          </>
        }
      />
      <RaioXPeriodLeakageControls
        months={months}
        leakageOnly={leakageOnly}
        setMonths={setMonths}
        setLeakageOnly={setLeakageOnly}
      />
      <ErrorText
        message={
          budget.error ??
          previousCash.error ??
          accounts.error ??
          entries.error ??
          yearsBudget.error
        }
      />
      {(budget.loading && !data) || loadingRange ? <Loading /> : null}
      {data && !leakageOnly ? (
        <RaioXHero
          previousMonthBalance={previousCash.data?.balance ?? 0}
          incomeActual={incomeActual}
          discountActual={discountDisplay}
          discountForSpendable={discountForSpendable}
          discountIsPlannedOnly={discountIsPlannedOnly}
          monthBalance={monthBalance}
          focus={focus}
          onFocus={toggleFocus}
          months={months}
          ym={ym}
        />
      ) : null}
      {leakageOnly ? (
        <p className={styles.leakageScopeNote} role="status">
          Filtro ativo: só contas em 100% ou mais na árvore. Resumo e Previsto×realizado ficam ocultos.
        </p>
      ) : null}
      {data && !leakageOnly ? (
        <RaioXSideCards
          budget={data}
          accounts={list}
          byParent={byParent}
          planned={planned}
          actual={actual}
          projects={projects.data ?? []}
          projectsLoading={projects.loading && !projects.data}
          scope={scope}
          focus={focus}
          onFocus={toggleFocus}
          onExpandSection={(section, options) => {
            setFocus(null)
            const head = sectionHead(list, section)
            if (!head) {
              return
            }
            const focusId = options?.accountId ?? head.id
            setOpen((current) => {
              const next = new Set(current)
              next.add(head.id)
              next.add(focusId)
              for (const id of ancestorIds(focusId, list)) {
                next.add(id)
              }
              for (const root of rootRows) {
                if (root.id === head.id || ancestorIds(focusId, list).includes(root.id)) {
                  next.add(root.id)
                }
              }
              return next
            })
            // Barras do Previsto×realizado (ex.: Essencial) são sintéticas: com valor → Busca
            // (API inclui descendentes). Zerada analítica → Orçamento; sintética zerada só expande.
            const totals = sumBranch(focusId, byParent, planned, actual)
            const zerada =
              Math.abs(totals.planned) <= 0.001 && Math.abs(totals.actual) <= 0.001
            if (!zerada) {
              openBusca({ categoryId: focusId })
              return
            }
            const target = list.find((item) => item.id === focusId)
            if (target?.level === 'Analytical') {
              openBudgetForAccount(focusId)
            }
          }}
        />
      ) : null}
      {accounts.loading && !accounts.data ? <Loading /> : null}
      {freeLimited && !fullAccess ? <p className={styles.muted}>{FREE_TIER_CATEGORY_LABEL}</p> : null}
      {rootRows.length > 0 && leakageOnly && !hasLeakage ? <RaioXNoLeakageCelebrate /> : null}
      {rootRows.length > 0 && !(leakageOnly && !hasLeakage) ? (
        <RaioXTreeList
          rootRows={rootRows}
          byParent={byParent}
          planned={planned}
          actual={actual}
          open={open}
          highlighted={highlighted}
          entriesByAccount={entriesByAccount}
          categoryNameById={categoryNameById}
          bankNameById={bankNameById}
          leakageOnly={leakageOnly}
          freeLimited={freeLimited}
          categoryUnlocked={categoryUnlocked}
          onToggle={toggle}
          onSelect={() => {}}
          onOpenEntry={openEntry}
          onOpenActual={openActualForAccount}
          onUnbudgetedClick={openBudgetForAccount}
        />
      ) : null}
    </div>
  )
}
