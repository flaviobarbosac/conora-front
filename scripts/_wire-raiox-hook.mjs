import fs from 'fs'

const path = 'd:/Projetos/Onra/Conora-frontEnd/src/pages/RaioXPage.tsx'
const src = fs.readFileSync(path, 'utf8')
const marker = 'export function RaioXPage() {'
const idx = src.indexOf(marker)
if (idx < 0) throw new Error('no export')
const after = src.indexOf(
  '  useEffect(() => {\n    if (!focusSection || list.length === 0)',
  idx,
)
if (after < 0) throw new Error('no after marker')

const header = `import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  type Category,
  entryDisplayDescription,
} from '../api/finance'
import { CompetencePicker } from '../components/CompetencePicker'
import { PageHeader } from '../components/PageHeader'
import { SharingViewToggle } from '../components/SharingViewToggle'
import { ProgressToneLegend } from '../components/ProgressToneLegend'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useRaioXPageController } from '../hooks/useRaioXPageController'
import { isFreeCategoryCode } from '../lib/freeTier'
import { buildBudgetMacroBars } from '../lib/homeInsights'
import { formatCompetence, formatDate, formatMoney, formatPercent } from '../lib/format'
import {
  focusSections,
  progressPercent,
  progressTone,
  sectionHead,
  sectionPlannedActual,
  sumBranch,
  type RaioXFocus,
  type RaioXTotals,
} from '../lib/raioX'
import { clearRaioXReturn, readRaioXReturn, saveRaioXReturn } from '../lib/raioXReturn'
import pageStyles from './page.module.css'
import raioStyles from './raioX/raioX.module.css'

const styles = { ...pageStyles, ...raioStyles }

import {
  MONTHS_MIN,
  MONTHS_MAX,
  MONTH_MARKS,
  RAIOX_ANCHORS,
  scrollToRaioXAnchor,
  isRaioXVisibleAccount,
  isRaioXMacroSection,
  ancestorIds,
  RaioXAccountBlock,
  RaioXHero,
  RaioXSideCards,
  sumYearField,
  sumYearSection,
} from './raioX/raioXShared'

export function RaioXPage() {
  const navigate = useNavigate()
  const {
    freeLimited,
    fullAccess,
    searchParams,
    setSearchParams,
    focusSection,
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
    restoredReturnRef,
    monthList,
    yearNums,
    budget,
    yearsBudget,
    previousCash,
    accounts,
    entries,
    bankAccounts,
    planned,
    actual,
    list,
    byParent,
    expenseHead,
    rootRows,
    hasLeakage,
    categoryNameById,
    bankNameById,
    entriesByAccount,
  } = useRaioXPageController()

`

const next = header + src.slice(after)
fs.writeFileSync(path, next)
console.log('RaioXPage lines', next.split('\n').length)
