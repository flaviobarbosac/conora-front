import fs from 'fs'

const path = 'd:/Projetos/Onra/Conora-frontEnd/src/pages/raioX/raioXShared.tsx'
const text = fs.readFileSync(path, 'utf8')
const m = text.match(/^([\s\S]*?\n)(const styles[\s\S]*)$/)
if (!m) {
  console.error('no match')
  process.exit(1)
}
const body = m[2]
const used = (name) => new RegExp(`\\b${name}\\b`).test(body)

const lines = []

const reactUsed = ['useEffect', 'useMemo', 'useRef', 'useState'].filter(used)
if (reactUsed.length) lines.push(`import { ${reactUsed.join(', ')} } from 'react'`)

const rr = ['useNavigate', 'useSearchParams'].filter(used)
if (rr.length) lines.push(`import { ${rr.join(', ')} } from 'react-router-dom'`)

const financeVals = ['accountsApi', 'budgetsApi', 'categoriesApi', 'entriesApi', 'entryDisplayDescription'].filter(
  used,
)
const financeTypes = ['Budget', 'BudgetYear', 'Category', 'CategorySection', 'Entry', 'SharingScope'].filter(used)
if (financeVals.length || financeTypes.length) {
  const parts = [...financeVals, ...financeTypes.map((t) => `type ${t}`)]
  lines.push(`import {\n  ${parts.join(',\n  ')},\n} from '../../api/finance'`)
}

const comps = [
  ['CompetencePicker', '../../components/CompetencePicker'],
  ['PageHeader', '../../components/PageHeader'],
  ['SharingViewToggle', '../../components/SharingViewToggle'],
  ['ProgressToneLegend', '../../components/ProgressToneLegend'],
]
for (const [name, from] of comps) {
  if (used(name)) lines.push(`import { ${name} } from '${from}'`)
}

const fb = ['ErrorText', 'Loading'].filter(used)
if (fb.length) lines.push(`import { ${fb.join(', ')} } from '../../components/ui/Feedback'`)

if (used('useLoad')) lines.push(`import { useLoad } from '../../hooks/useLoad'`)
if (used('usePlanAccess')) lines.push(`import { usePlanAccess } from '../../hooks/usePlanAccess'`)

const typeNames = new Set(['ProgressTone', 'RaioXFocus', 'RaioXTotals'])
const libGroups = [
  ['../../lib/categoryLabel', ['categoryLabel']],
  ['../../lib/categoryOrder', ['compareCategorySiblings', 'isCashFlowSection']],
  ['../../lib/homeInsights', ['buildBudgetMacroBars']],
  [
    '../../lib/format',
    ['currentCompetence', 'formatCompetence', 'formatDate', 'formatMoney', 'formatPercent', 'shiftCompetence'],
  ],
  [
    '../../lib/raioX',
    [
      'aggregateYearMonths',
      'buildAmountMaps',
      'chartWithAmounts',
      'focusSections',
      'groupAccountsByParent',
      'idsWithAmount',
      'monthsEndingAt',
      'progressPercent',
      'progressTone',
      'sectionHead',
      'sectionPlannedActual',
      'sumBranch',
      'yearsNeededForMonths',
      'ProgressTone',
      'RaioXFocus',
      'RaioXTotals',
    ],
  ],
  ['../../lib/freeTier', ['hasFullAccess', 'isFreeCategoryCode', 'isFreeLimited']],
  ['../../lib/raioXReturn', ['clearRaioXReturn', 'readRaioXReturn', 'saveRaioXReturn']],
  ['../../lib/sharingView', ['readSharingView']],
]
for (const [from, names] of libGroups) {
  const u = names.filter(used)
  if (!u.length) continue
  const parts = u.map((n) => (typeNames.has(n) ? `type ${n}` : n))
  lines.push(`import {\n  ${parts.join(',\n  ')},\n} from '${from}'`)
}

lines.push(`import pageStyles from '../pageStyles'`)
lines.push(`import raioStyles from './raioX.module.css'`)
lines.push('')

fs.writeFileSync(path, `${lines.join('\n')}\n${body}`)
console.log('kept imports:', lines.length)
