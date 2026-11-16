/**
 * Split finance monolith into types.ts, helpers.ts, and *Api.ts files.
 * Source: src/api/finance/_monolith.ts (UTF-8 copy of HEAD finance.ts).
 */
import fs from 'fs'

const dir = 'd:/Projetos/Onra/Conora-frontEnd/src/api/finance'
const srcPath = `${dir}/_monolith.ts`
const src = fs.readFileSync(srcPath, 'utf8')

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

function skipWs(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++
  return i
}

function braceEnd(s, open) {
  let d = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') d++
    else if (s[i] === '}') {
      d--
      if (d === 0) return i + 1
    }
  }
  throw new Error('unbalanced { at ' + open)
}

function parseType(s, start) {
  let i = start + 'export type '.length
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
  if (s[i] !== '=') throw new Error('type = expected at ' + start)
  i++
  i = skipWs(s, i)

  // object, intersection (... & { ... }), union, or alias
  while (true) {
    if (s[i] === '{') {
      i = braceEnd(s, i)
      i = skipWs(s, i)
      if (s[i] === '&') {
        i++
        i = skipWs(s, i)
        continue
      }
      break
    }
    // named type or union/literal until newline (unless continues with | or &)
    while (i < s.length) {
      if (s[i] === '{') break
      if (s[i] === ';') {
        i++
        break
      }
      if (s[i] === '\n') {
        const n = skipWs(s, i + 1)
        if (s[n] === '|' || s[n] === '&') {
          i = n
          continue
        }
        // peek: more of same type? stop.
        i++
        break
      }
      i++
    }
    i = skipWs(s, i)
    if (s[i] === '{') continue
    if (s[i] === '&') {
      i++
      i = skipWs(s, i)
      continue
    }
    break
  }
  i = skipWs(s, i)
  return { end: i, text: s.slice(start, i).trim() }
}

function parseFn(s, start) {
  const head = s.slice(start).match(/^(export\s+)?(async\s+)?function\s+(\w+)/)
  if (!head) return null
  let i = start + head[0].length
  i = skipWs(s, i)
  if (s[i] !== '(') throw new Error('fn (')
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
  if (s[i] === ':') {
    i++
    while (i < s.length && s[i] !== '{') {
      if (s[i] === '<' || s[i] === '(') {
        const open = s[i]
        const close = open === '<' ? '>' : ')'
        let dd = 0
        for (; i < s.length; i++) {
          if (s[i] === open) dd++
          else if (s[i] === close) {
            dd--
            if (dd === 0) {
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
  if (s[i] !== '{') throw new Error('fn body missing near ' + start)
  i = braceEnd(s, i)
  let text = s.slice(start, i).trim()
  if (!text.startsWith('export')) text = 'export ' + text
  return { end: i, name: head[3], text }
}

function parseConst(s, start) {
  const head = s.slice(start).match(/^(export\s+)?const\s+(\w+)\s*=/)
  if (!head) return null
  const name = head[2]
  let i = start + head[0].length
  i = skipWs(s, i)
  if (s[i] === '{') {
    i = braceEnd(s, i)
  } else {
    let dp = 0
    let db = 0
    for (; i < s.length; i++) {
      if (s[i] === '(') dp++
      else if (s[i] === ')') dp--
      else if (s[i] === '{') db++
      else if (s[i] === '}') db--
      else if (s[i] === ';' && dp === 0 && db === 0) {
        i++
        break
      } else if (s[i] === '\n' && dp === 0 && db === 0 && s.slice(start, i).includes('=>')) {
        break
      }
    }
  }
  i = skipWs(s, i)
  let text = s.slice(start, i).trim()
  if (!text.startsWith('export')) text = 'export ' + text
  return { end: i, name, text, isApi: name.endsWith('Api') }
}

const types = []
const helpers = []
const apis = new Map()
let i = 0
const skips = []

while (i < src.length) {
  i = skipWs(src, i)
  if (i >= src.length) break
  if (src.startsWith('/*', i)) {
    const end = src.indexOf('*/', i + 2)
    i = end < 0 ? src.length : end + 2
    continue
  }
  if (src.startsWith('//', i)) {
    const end = src.indexOf('\n', i)
    i = end < 0 ? src.length : end + 1
    continue
  }
  if (src.startsWith('import ', i)) {
    const end = src.indexOf('\n', i)
    i = end < 0 ? src.length : end + 1
    continue
  }
  if (src.startsWith('export type ', i)) {
    const t = parseType(src, i)
    types.push(t.text)
    i = t.end
    continue
  }
  if (/^(export\s+)?(async\s+)?function\s+/.test(src.slice(i))) {
    const f = parseFn(src, i)
    helpers.push(f.text)
    i = f.end
    continue
  }
  if (/^(export\s+)?const\s+/.test(src.slice(i))) {
    const c = parseConst(src, i)
    if (c.isApi) {
      const file = fileFor[c.name] || c.name
      if (!apis.has(file)) apis.set(file, [])
      apis.get(file).push(c.text)
    } else {
      helpers.push(c.text)
    }
    i = c.end
    continue
  }
  const nl = src.indexOf('\n', i)
  skips.push(src.slice(i, Math.min(i + 60, nl < 0 ? i + 60 : nl)))
  i = nl < 0 ? src.length : nl + 1
}

if (skips.length) {
  console.warn('SKIP count', skips.length, skips.slice(0, 5))
}

const typeNames = types.map((t) => t.match(/^export type (\w+)/)?.[1]).filter(Boolean)
fs.writeFileSync(`${dir}/types.ts`, types.join('\n\n') + '\n')
fs.writeFileSync(`${dir}/helpers.ts`, `import type { Entry } from './types'\n\n${helpers.join('\n\n')}\n`)

const clientSymbols = ['apiBlob', 'apiFetch', 'apiFormData']
const helperSymbols = ['query', 'json', 'entryDisplayDescription']

for (const [file, blocks] of apis) {
  const body = blocks.join('\n\n') + '\n'
  const usedTypes = typeNames.filter((t) => new RegExp(`\\b${t}\\b`).test(body))
  const usedClient = clientSymbols.filter((s) => new RegExp(`\\b${s}\\b`).test(body))
  const usedHelpers = helperSymbols.filter((s) => new RegExp(`\\b${s}\\b`).test(body))
  const lines = []
  if (usedClient.length) lines.push(`import { ${usedClient.join(', ')} } from '../client'`)
  if (usedHelpers.length) lines.push(`import { ${usedHelpers.join(', ')} } from './helpers'`)
  if (usedTypes.length) {
    lines.push(`import type {\n  ${usedTypes.join(',\n  ')},\n} from './types'`)
  }
  lines.push('')
  fs.writeFileSync(`${dir}/${file}.ts`, `${lines.join('\n')}${body}`)
}

const apiFiles = [...apis.keys()]
fs.writeFileSync(
  `${dir}/index.ts`,
  [`export type * from './types'`, `export * from './helpers'`, ...apiFiles.map((f) => `export * from './${f}'`)].join(
    '\n',
  ) + '\n',
)
fs.writeFileSync('d:/Projetos/Onra/Conora-frontEnd/src/api/finance.ts', `export * from './finance/index'\n`)
fs.writeFileSync(
  `${dir}/clientApis.ts`,
  `/** @deprecated Prefer api/finance barrel */\nexport * from './index'\n`,
)

console.log({
  types: typeNames.length,
  helpers: helpers.length,
  apis: apiFiles.map((f) => [f, apis.get(f).length]),
  consoleFeedbackOk: types.some((t) => t.includes('ConsoleFeedbackItem') && t.includes('status: FeedbackStatus')),
})
if (typeNames.length < 80 || apiFiles.length < 15) {
  console.error('Split looks incomplete')
  process.exit(2)
}
