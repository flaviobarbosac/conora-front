import fs from 'fs'

const dir = 'd:/Projetos/Onra/Conora-frontEnd/src/api/finance'
const path = `${dir}/clientApis.ts`
const original = fs.readFileSync(path, 'utf8')

const fileFor = {
  categoriesApi: 'categoriesApi',
  accountsApi: 'accountsApi',
  cardsApi: 'cardsApi',
  entriesApi: 'entriesApi',
  dashboardApi: 'reportsApi',
  exportApi: 'reportsApi',
  budgetsApi: 'budgetsApi',
  diagnosisApi: 'diagnosisApi',
  projectsApi: 'projectsApi',
  gamificationApi: 'gamificationApi',
  patrimonyApi: 'patrimonyApi',
  membersApi: 'familyApi',
  familyApi: 'familyApi',
  planApi: 'planApi',
  feedbackApi: 'feedbackApi',
  helpApi: 'helpApi',
  aiApi: 'aiApi',
  whatsappApi: 'whatsappApi',
  receiptsApi: 'receiptsApi',
  importsApi: 'importsApi',
  monthsApi: 'monthsApi',
  lgpdApi: 'lgpdApi',
  auditApi: 'auditApi',
  consoleApi: 'consoleApi',
  journeyApi: 'journeyApi',
}

function braceEnd(s, openIdx) {
  let d = 0
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') d++
    else if (s[i] === '}') {
      d--
      if (d === 0) return i + 1
    }
  }
  throw new Error('unbalanced brace at ' + openIdx)
}

function skipWs(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++
  return i
}

/** Parse one export type starting at index. */
function parseExportType(s, start) {
  if (!s.startsWith('export type ', start)) return null
  let i = start + 'export type '.length
  // name + optional <...>  (track angle depth)
  while (i < s.length) {
    if (s[i] === '<') {
      let d = 0
      for (; i < s.length; i++) {
        if (s[i] === '<') d++
        else if (s[i] === '>') {
          d--
          if (d === 0) {
            i++
            break
          }
        }
      }
      continue
    }
    if (/[A-Za-z0-9_]/.test(s[i])) {
      i++
      continue
    }
    break
  }
  i = skipWs(s, i)
  if (s[i] !== '=') throw new Error('expected = in type at ' + start + ' got ' + JSON.stringify(s.slice(i, i + 20)))
  i++
  i = skipWs(s, i)
  if (s[i] === '{') {
    i = braceEnd(s, i)
  } else {
    // alias / union — semicolon optional; continue while next line starts with |
    while (i < s.length) {
      if (s[i] === ';') {
        i++
        break
      }
      if (s[i] === '\n') {
        const next = skipWs(s, i + 1)
        if (s[next] === '|') {
          i = next
          continue
        }
        i++
        break
      }
      i++
    }
  }
  while (i < s.length && /[;\s]/.test(s[i])) i++
  return { start, end: i, text: s.slice(start, i).trim() }
}

function parseExportConstObject(s, start) {
  const m = /^export const (\w+)\s*=\s*/.exec(s.slice(start))
  if (!m) return null
  const name = m[1]
  let i = start + m[0].length
  i = skipWs(s, i)
  if (s[i] !== '{') return null
  i = braceEnd(s, i)
  while (i < s.length && /[;\s]/.test(s[i])) i++
  return { start, end: i, name, text: s.slice(start, i).trim() }
}

function parseFunction(s, start, name) {
  const re = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`)
  if (!re.test(s.slice(start))) return null
  const openParen = s.indexOf('(', start)
  // find ) then {
  let i = openParen
  let d = 0
  for (; i < s.length; i++) {
    if (s[i] === '(') d++
    else if (s[i] === ')') {
      d--
      if (d === 0) {
        i++
        break
      }
    }
  }
  i = skipWs(s, i)
  // optional return type: : string | Promise<...>
  if (s[i] === ':') {
    i++
    i = skipWs(s, i)
    while (i < s.length && s[i] !== '{') {
      if (s[i] === '{') break
      // skip nested <> and ()
      if (s[i] === '<' || s[i] === '(') {
        const open = s[i]
        const close = open === '<' ? '>' : ')'
        let d = 0
        for (; i < s.length; i++) {
          if (s[i] === open) d++
          else if (s[i] === close) {
            d--
            if (d === 0) {
              i++
              break
            }
          }
        }
        continue
      }
      i++
    }
  }
  i = skipWs(s, i)
  if (s[i] !== '{') throw new Error('fn body at ' + i + ': ' + JSON.stringify(s.slice(i, i + 40)))
  i = braceEnd(s, i)
  while (i < s.length && /\s/.test(s[i])) i++
  let text = s.slice(start, i).trim()
  if (!text.startsWith('export')) text = 'export ' + text
  return { start, end: i, text }
}

function parseConstArrow(s, start, name) {
  const re = new RegExp(`^(?:export\\s+)?const\\s+${name}\\s*=`)
  if (!re.test(s.slice(start))) return null
  const m = re.exec(s.slice(start))
  let i = start + m[0].length
  // read until semicolon at top level
  let dParen = 0
  let dBrace = 0
  for (; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') dParen++
    else if (ch === ')') dParen--
    else if (ch === '{') dBrace++
    else if (ch === '}') dBrace--
    else if (ch === ';' && dParen === 0 && dBrace === 0) {
      i++
      break
    }
  }
  while (i < s.length && /\s/.test(s[i])) i++
  let text = s.slice(start, i).trim()
  if (!text.startsWith('export')) text = 'export ' + text
  return { start, end: i, text }
}

// Walk file collecting ranges
const types = []
const helpers = []
const apis = new Map()
const remove = []

let i = 0
const s = original
while (i < s.length) {
  i = skipWs(s, i)
  if (i >= s.length) break
  if (s.startsWith('/*', i)) {
    const end = s.indexOf('*/', i + 2)
    i = end < 0 ? s.length : end + 2
    continue
  }
  if (s.startsWith('//', i)) {
    const end = s.indexOf('\n', i)
    i = end < 0 ? s.length : end + 1
    continue
  }
  if (s.startsWith('import ', i)) {
    const end = s.indexOf('\n', i)
    i = end < 0 ? s.length : end + 1
    continue
  }

  if (s.startsWith('export type ', i)) {
    const t = parseExportType(s, i)
    types.push(t.text)
    remove.push([t.start, t.end])
    i = t.end
    continue
  }

  const fnQuery = parseFunction(s, i, 'query')
  if (fnQuery) {
    helpers.push(fnQuery.text)
    remove.push([fnQuery.start, fnQuery.end])
    i = fnQuery.end
    continue
  }
  const fnEntry = parseFunction(s, i, 'entryDisplayDescription')
  if (fnEntry) {
    helpers.push(fnEntry.text)
    remove.push([fnEntry.start, fnEntry.end])
    i = fnEntry.end
    continue
  }
  const jsonC = parseConstArrow(s, i, 'json')
  if (jsonC) {
    helpers.push(jsonC.text)
    remove.push([jsonC.start, jsonC.end])
    i = jsonC.end
    continue
  }

  const api = parseExportConstObject(s, i)
  if (api && api.name.endsWith('Api')) {
    const file = fileFor[api.name] || api.name
    if (!apis.has(file)) apis.set(file, [])
    apis.get(file).push(api.text)
    remove.push([api.start, api.end])
    i = api.end
    continue
  }

  // skip one line if unrecognized
  const nl = s.indexOf('\n', i)
  if (nl < 0) break
  console.warn('skip-line', s.slice(i, Math.min(i + 60, nl)))
  i = nl + 1
}

const typeNames = types.map((t) => t.match(/^export type (\w+)/)?.[1]).filter(Boolean)
fs.writeFileSync(`${dir}/types.ts`, types.join('\n\n') + '\n')
fs.writeFileSync(`${dir}/helpers.ts`, `import type { Entry } from './types'\n\n${helpers.join('\n\n')}\n`)

const importClient = `import { apiBlob, apiFetch, apiFormData } from '../client'\n`
const typeImp = `import type {\n  ${[...new Set(typeNames)].join(',\n  ')},\n} from './types'\n`

for (const [file, blocks] of apis) {
  const body = blocks.join('\n\n')
  const needs = []
  if (/\bquery\b/.test(body)) needs.push('query')
  if (/\bjson\b/.test(body)) needs.push('json')
  fs.writeFileSync(
    `${dir}/${file}.ts`,
    `${importClient}${typeImp}${needs.length ? `import { ${needs.join(', ')} } from './helpers'\n` : ''}\n${body}\n`,
  )
}

const files = [...apis.keys()]
fs.writeFileSync(
  `${dir}/index.ts`,
  [`export type * from './types'`, `export * from './helpers'`, ...files.map((f) => `export * from './${f}'`)].join('\n') +
    '\n',
)
fs.writeFileSync('d:/Projetos/Onra/Conora-frontEnd/src/api/finance.ts', `export * from './finance/index'\n`)
fs.writeFileSync(path, `/** @deprecated Use api/finance barrel */\nexport * from './index'\n`)

console.log({ types: typeNames.length, helpers: helpers.length, apis: [...apis.entries()].map(([k, v]) => [k, v.length]) })
