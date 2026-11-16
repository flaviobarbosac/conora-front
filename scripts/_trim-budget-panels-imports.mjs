import fs from 'fs'

const path = 'd:/Projetos/Onra/Conora-frontEnd/src/pages/budget/BudgetPagePanels.tsx'
const text = fs.readFileSync(path, 'utf8')

// Keep everything after the styles merge line (or first export)
const stylesIdx = text.indexOf('const styles =')
if (stylesIdx < 0) {
  console.error('styles not found')
  process.exit(1)
}
// find end of styles block line
const afterStyles = text.indexOf('\n', stylesIdx)
const bodyStart = text.indexOf('\n', afterStyles + 1)
// Actually keep from first `export ` after imports — simpler: find first export function/const
const exportIdx = text.search(/^export /m)
const body = text.slice(exportIdx)
const importRegion = text.slice(0, exportIdx)

// Collect identifiers referenced in body
function used(name) {
  return new RegExp(`\\b${name}\\b`).test(body)
}

// Parse existing imports roughly and rebuild only used ones — reuse known set from file head
const lines = []
const reactBits = [
  'useEffect',
  'useId',
  'useMemo',
  'useState',
  'FormEvent',
  'ReactNode',
].filter((n) => used(n) || n === 'FormEvent' || n === 'ReactNode')
// only keep type imports if used as type
const reactVals = ['useEffect', 'useId', 'useMemo', 'useState'].filter(used)
const reactTypes = ['FormEvent', 'ReactNode'].filter(used)
if (reactVals.length || reactTypes.length) {
  const parts = [...reactVals, ...reactTypes.map((t) => `type ${t}`)]
  lines.push(`import { ${parts.join(', ')} } from 'react'`)
}

if (used('createPortal')) lines.push(`import { createPortal } from 'react-dom'`)
const rr = ['useNavigate', 'useSearchParams'].filter(used)
if (rr.length) lines.push(`import { ${rr.join(', ')} } from 'react-router-dom'`)

// For finance — scan original import list from importRegion
const financeMatch = importRegion.match(/import \{([\s\S]*?)\} from '\.\.\/\.\.\/api\/finance'/)
if (financeMatch) {
  const names = [...financeMatch[1].matchAll(/(?:type\s+)?(\w+)/g)].map((m) => m[1])
  const typeish = new Set(
    [...financeMatch[1].matchAll(/type\s+(\w+)/g)].map((m) => m[1]),
  )
  // also treat XxxInput / types as types when originally type
  const kept = names.filter(used)
  if (kept.length) {
    const parts = kept.map((n) => (typeish.has(n) || /^[A-Z]/.test(n) && !n.endsWith('Api') ? `type ${n}` : n))
    // Fix: APIs are camelCase ending Api; values like budgetsApi. Types start with uppercase.
    const fixed = kept.map((n) => {
      if (n.endsWith('Api') || n === n[0].toLowerCase() + n.slice(1)) return n
      return `type ${n}`
    })
    lines.push(`import {\n  ${fixed.join(',\n  ')},\n} from '../../api/finance'`)
  }
}

// Component / lib imports: keep lines from original if their primary symbol is used
for (const line of importRegion.split('\n')) {
  if (!line.startsWith('import ')) continue
  if (line.includes("from 'react'") || line.includes('react-dom') || line.includes('react-router')) continue
  if (line.includes('api/finance')) continue
  if (line.includes('pageStyles') || line.includes('budget.module')) {
    lines.push(line)
    continue
  }
  // multi-line handled poorly — skip; we'll re-add single-line only
  const sym = line.match(/import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))/)
  if (!sym) continue
  const names = (sym[1] || sym[2] || '')
    .split(',')
    .map((s) => s.replace(/^type\s+/, '').trim())
    .filter(Boolean)
  if (names.some(used)) lines.push(line)
}

// multi-line imports in original — handle by scanning known paths
const multiline = [
  ...importRegion.matchAll(/import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+'([^']+)'/g),
]
for (const m of multiline) {
  const from = m[2]
  if (from === 'react' || from === 'react-dom' || from === 'react-router-dom' || from.endsWith('api/finance')) continue
  if (from.includes('pageStyles') || from.includes('budget.module')) continue
  const names = [...m[1].matchAll(/(?:type\s+)?(\w+)/g)].map((x) => x[1])
  const typeish = new Set([...m[1].matchAll(/type\s+(\w+)/g)].map((x) => x[1]))
  const kept = names.filter(used)
  if (!kept.length) continue
  // avoid duplicate if already added as single-line
  if (lines.some((l) => l.includes(`from '${from}'`))) continue
  const parts = kept.map((n) => (typeish.has(n) ? `type ${n}` : n))
  lines.push(`import {\n  ${parts.join(',\n  ')},\n} from '${from}'`)
}

if (!lines.some((l) => l.includes('pageStyles'))) {
  lines.push(`import pageStyles from '../pageStyles'`)
}
if (!lines.some((l) => l.includes('budget.module'))) {
  lines.push(`import budgetStyles from './budget.module.css'`)
}
lines.push('')
const stylesLine = text.slice(stylesIdx, exportIdx).trim()
fs.writeFileSync(path, `${lines.join('\n')}\n${stylesLine}\n\n${body}`)
console.log('budget panels imports', lines.length)
