/**
 * Structural health split:
 * - Budget/RaioX: extract panels + custom hooks (container/presentational)
 * - CSS: move .budget* / .raiox* rules into feature CSS modules
 */
import fs from 'fs'
import path from 'path'

const pages = 'd:/Projetos/Onra/Conora-frontEnd/src/pages'
const hooksDir = 'd:/Projetos/Onra/Conora-frontEnd/src/hooks'

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function extractCssByPrefix(cssText, prefixes) {
  const lines = cssText.split(/\r?\n/)
  const keep = []
  const moved = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    // start of a rule: .foo or .foo, .bar {
    if (trimmed.startsWith('.') || trimmed.startsWith('@media') || trimmed.startsWith('@supports')) {
      // gather until brace balance 0 after first {
      let block = [line]
      let j = i
      let depth = 0
      let started = false
      while (j < lines.length) {
        const l = lines[j]
        for (const ch of l) {
          if (ch === '{') {
            depth++
            started = true
          } else if (ch === '}') depth--
        }
        if (j > i) block.push(l)
        j++
        if (started && depth <= 0) break
      }
      const header = block.join('\n')
      const isFeature = prefixes.some((p) => new RegExp(`\\.${p}[A-Za-z0-9_-]*`).test(header))
      if (isFeature && !trimmed.startsWith('@media') && !trimmed.startsWith('@supports')) {
        moved.push(...block, '')
      } else if (
        (trimmed.startsWith('@media') || trimmed.startsWith('@supports')) &&
        prefixes.some((p) => new RegExp(`\\.${p}[A-Za-z0-9_-]*`).test(header))
      ) {
        // media query containing only feature? keep in page for safety if mixed; move if majority feature
        const featureHits = prefixes.reduce(
          (n, p) => n + (header.match(new RegExp(`\\.${p}`, 'g')) || []).length,
          0,
        )
        const otherHits = (header.match(/\.[a-zA-Z]/g) || []).length - featureHits
        if (featureHits > 0 && otherHits <= featureHits) moved.push(...block, '')
        else keep.push(...block)
      } else {
        keep.push(...block)
      }
      i = j
      continue
    }
    keep.push(line)
    i++
  }
  return { keep: keep.join('\n'), moved: moved.join('\n') }
}

function splitCssFeatures() {
  const cssPath = path.join(pages, 'page.module.css')
  const css = fs.readFileSync(cssPath, 'utf8')
  const budgetDir = path.join(pages, 'budget')
  const raioDir = path.join(pages, 'raioX')
  ensureDir(budgetDir)
  ensureDir(raioDir)

  // Extract budget first from full css
  const b = extractCssByPrefix(css, ['budget'])
  fs.writeFileSync(path.join(budgetDir, 'budget.module.css'), b.moved || '/* budget feature */\n')
  // Extract raiox from remaining
  const r = extractCssByPrefix(b.keep, ['raiox'])
  fs.writeFileSync(path.join(raioDir, 'raioX.module.css'), r.moved || '/* raio-x feature */\n')
  fs.writeFileSync(cssPath, r.keep.endsWith('\n') ? r.keep : `${r.keep}\n`)
  console.log(
    'CSS lines page/budget/raiox',
    r.keep.split(/\n/).length,
    (b.moved || '').split(/\n/).length,
    (r.moved || '').split(/\n/).length,
  )
}

function splitBudgetPage() {
  const budgetPath = path.join(pages, 'BudgetPage.tsx')
  const lines = fs.readFileSync(budgetPath, 'utf8').split(/\r?\n/)
  const treeStart = lines.findIndex((l) => l.startsWith('function BudgetTreeEditor'))
  if (treeStart < 0) throw new Error('BudgetTreeEditor missing')
  const headerEnd = lines.findIndex((l) => l.startsWith('export function BudgetPage'))
  const importBlock = lines.slice(0, headerEnd).join('\n')
  const mainPart = lines.slice(0, treeStart).join('\n')
  let panels = lines.slice(treeStart).join('\n')
  panels = panels.replace('function BudgetTreeEditor', 'export function BudgetTreeEditor')

  const dir = path.join(pages, 'budget')
  ensureDir(dir)

  // Panels live in pages/budget/ → bump ../ to ../../ for former pages/* imports
  let panelsImports = importBlock.replace(
    "import styles from './page.module.css'",
    "import pageStyles from '../page.module.css'\nimport budgetStyles from './budget.module.css'\n\nconst styles = { ...pageStyles, ...budgetStyles }",
  )
  panelsImports = panelsImports
    .split('\n')
    .map((line) => {
      if (line.includes("from '../page.module.css'") || line.includes("from './budget.module.css'")) {
        return line
      }
      return line.replace("from '../", "from '../../")
    })
    .join('\n')

  fs.writeFileSync(path.join(dir, 'BudgetPagePanels.tsx'), `${panelsImports}\n\n${panels}\n`)

  // Hook: extract data-loading state from BudgetPage body heuristically into useBudgetPageController
  // Keep container thin: import hook + view later; for now import panels and merge styles in page.
  let slim = mainPart
  slim = slim.replace(
    "import styles from './page.module.css'",
    "import pageStyles from './page.module.css'\nimport budgetStyles from './budget/budget.module.css'\nimport { BudgetTreeEditor } from './budget/BudgetPagePanels'\n\nconst styles = { ...pageStyles, ...budgetStyles }",
  )
  fs.writeFileSync(budgetPath, slim.endsWith('\n') ? slim : `${slim}\n`)

  // Write hook with the loaders pattern (copy of state section documented)
  ensureDir(hooksDir)
  const hook = `import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  budgetsApi,
  categoriesApi,
  monthsApi,
  projectsApi,
  type SharingScope,
} from '../api/finance'
import { useLoad } from './useLoad'
import { useUnsavedChanges } from './useUnsavedChanges'
import { currentCompetence } from '../lib/format'
import { readSharingView } from '../lib/sharingView'

function safeReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  if (!raw.startsWith('/raio-x')) return null
  return raw
}

/** Container state for Budget page (data + route params). */
export function useBudgetPageController() {
  const [searchParams, setSearchParams] = useSearchParams()
  const focusCategoryId = searchParams.get('categoryId')
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const [ym, setYm] = useState(() => searchParams.get('competenceYm') || currentCompetence())
  const [scope, setScope] = useState<SharingScope | undefined>(() => readSharingView())
  const { confirmLeave, isDirty } = useUnsavedChanges()
  const budget = useLoad(() => budgetsApi.get(ym, scope), [ym, scope])
  const year = useMemo(() => Number(ym.slice(0, 4)), [ym])
  const yearData = useLoad(() => budgetsApi.getYear(year, scope), [year, scope])
  const categories = useLoad(() => categoriesApi.list(undefined, false, false), [])
  const projects = useLoad(() => projectsApi.list(), [])
  const monthStatus = useLoad(() => monthsApi.get(ym), [ym])

  return {
    searchParams,
    setSearchParams,
    focusCategoryId,
    returnTo,
    ym,
    setYm,
    scope,
    setScope,
    confirmLeave,
    isDirty,
    budget,
    year,
    yearData,
    categories,
    projects,
    monthStatus,
  }
}
`
  fs.writeFileSync(path.join(hooksDir, 'useBudgetPageController.ts'), hook)
  console.log('BudgetPage', slim.split('\n').length, 'panels written + hook')
}

function splitRaioXPage() {
  const raioPath = path.join(pages, 'RaioXPage.tsx')
  const lines = fs.readFileSync(raioPath, 'utf8').split(/\r?\n/)
  const exportIdx = lines.findIndex((l) => l.startsWith('export function RaioXPage'))
  const afterIdx = lines.findIndex((l, i) => i > exportIdx && l.startsWith('function EntrySubRow'))
  const firstConst = lines.findIndex((l) => l.startsWith('const MONTHS_MIN'))
  const importBlock = lines.slice(0, firstConst).join('\n')
  let before = lines.slice(firstConst, exportIdx).join('\n')
  const page = lines.slice(exportIdx, afterIdx).join('\n')
  let after = lines.slice(afterIdx).join('\n')

  const fns = [
    'EntrySubRow',
    'RaioXAccountBlock',
    'RaioXHero',
    'RaioXSideCards',
    'TotalsCell',
    'scrollToRaioXAnchor',
    'isRaioXVisibleAccount',
    'isRaioXMacroSection',
    'focusClass',
    'toneClass',
    'signedMoneyClass',
    'parseSectionParam',
    'sumYearField',
    'sumYearSection',
    'ancestorIds',
    'branchHasLeakage',
    'branchHasAmount',
    'accountBarColor',
    'ConsumptionBar',
    'consumptionLabel',
  ]
  for (const name of fns) {
    before = before.replaceAll(`function ${name}`, `export function ${name}`)
    after = after.replaceAll(`function ${name}`, `export function ${name}`)
  }
  before = before
    .replace('const MONTHS_MIN', 'export const MONTHS_MIN')
    .replace('const MONTHS_MAX', 'export const MONTHS_MAX')
    .replace('const MONTH_MARKS', 'export const MONTH_MARKS')
    .replace('const RAIOX_ANCHORS', 'export const RAIOX_ANCHORS')
  after = after.replace('const ACCOUNT_BAR_COLOR', 'export const ACCOUNT_BAR_COLOR')

  const dir = path.join(pages, 'raioX')
  ensureDir(dir)

  let sharedImports = importBlock.replace(
    "import styles from './page.module.css'",
    "import pageStyles from '../page.module.css'\nimport raioStyles from './raioX.module.css'\n\nconst styles = { ...pageStyles, ...raioStyles }",
  )
  sharedImports = sharedImports
    .split('\n')
    .map((line) => {
      if (line.includes("from '../page.module.css'") || line.includes("from './raioX.module.css'")) {
        return line
      }
      return line.replace("from '../", "from '../../")
    })
    .join('\n')

  fs.writeFileSync(path.join(dir, 'raioXShared.tsx'), `${sharedImports}\n\n${before}\n\n${after}\n`)

  const used = [
    'MONTHS_MIN',
    'MONTHS_MAX',
    'MONTH_MARKS',
    'RAIOX_ANCHORS',
    'scrollToRaioXAnchor',
    'isRaioXVisibleAccount',
    'isRaioXMacroSection',
    'focusClass',
    'toneClass',
    'signedMoneyClass',
    'parseSectionParam',
    'sumYearField',
    'sumYearSection',
    'ancestorIds',
    'EntrySubRow',
    'RaioXAccountBlock',
    'RaioXHero',
    'RaioXSideCards',
    'TotalsCell',
    'branchHasLeakage',
    'branchHasAmount',
    'accountBarColor',
    'ConsumptionBar',
    'consumptionLabel',
  ].filter((s) => page.includes(s))

  let pageImports = importBlock.replace(
    "import styles from './page.module.css'",
    "import pageStyles from './page.module.css'\nimport raioStyles from './raioX/raioX.module.css'\n\nconst styles = { ...pageStyles, ...raioStyles }",
  )
  pageImports += `\nimport {\n  ${used.join(',\n  ')}\n} from './raioX/raioXShared'`
  fs.writeFileSync(raioPath, `${pageImports}\n\n${page}\n`)

  const hook = `import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { budgetsApi, categoriesApi, type CategorySection, type SharingScope } from '../api/finance'
import { useLoad } from './useLoad'
import { currentCompetence } from '../lib/format'
import { readSharingView } from '../lib/sharingView'
import { parseSectionParam } from '../pages/raioX/raioXShared'

/** Container state for Raio-X page. */
export function useRaioXPageController() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ym, setYm] = useState(() => searchParams.get('competenceYm') || currentCompetence())
  const [scope, setScope] = useState<SharingScope | undefined>(() => readSharingView())
  const focusSection = useMemo(
    () => parseSectionParam(searchParams.get('section')),
    [searchParams],
  )
  const categories = useLoad(() => categoriesApi.list(undefined, false, false), [])
  const budget = useLoad(() => budgetsApi.get(ym, scope), [ym, scope])

  return { searchParams, setSearchParams, ym, setYm, scope, setScope, focusSection, categories, budget }
}
`
  fs.writeFileSync(path.join(hooksDir, 'useRaioXPageController.ts'), hook)
  console.log('RaioXPage', pageImports.split('\n').length + page.split('\n').length, 'shared+hook')
}

splitCssFeatures()
splitBudgetPage()
splitRaioXPage()
console.log('front split done')
