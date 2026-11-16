import fs from 'fs'

const dir = 'd:/Projetos/Onra/Conora-frontEnd/src/api/finance'
const srcPath = `${dir}/clientApis.ts`
const src = fs.readFileSync(srcPath, 'utf8')

const firstConst = src.search(/^export const \w+/m)
if (firstConst < 0) throw new Error('no export const')

const preambleEnd = src.indexOf('/* ---------- Enums')
const typesAndConsts = src.slice(preambleEnd)

const apiBlocks = []
const re = /^export const (\w+) = \{/gm
let m
while ((m = re.exec(typesAndConsts))) {
  const name = m[1]
  const start = m.index
  let i = typesAndConsts.indexOf('{', start)
  let depth = 0
  for (; i < typesAndConsts.length; i++) {
    const ch = typesAndConsts[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  while (i < typesAndConsts.length && /[;\s]/.test(typesAndConsts[i])) i++
  apiBlocks.push({ name, start, end: i, text: typesAndConsts.slice(start, i).trim() })
}

const typesOnly = `${typesAndConsts.slice(0, apiBlocks[0].start).trim()}\n`
fs.writeFileSync(`${dir}/types.ts`, `${typesOnly}`)

const typeNames = [...typesOnly.matchAll(/^export type (\w+)\b/gm)].map((x) => x[1])
const typeImport = `import type {\n  ${typeNames.join(',\n  ')},\n} from './types'\n`

const fileFor = {
  categoriesApi: 'categoriesApi.ts',
  accountsApi: 'accountsApi.ts',
  cardsApi: 'cardsApi.ts',
  entriesApi: 'entriesApi.ts',
  dashboardApi: 'dashboardApi.ts',
  exportApi: 'dashboardApi.ts',
  budgetsApi: 'budgetsApi.ts',
  diagnosisApi: 'diagnosisApi.ts',
  projectsApi: 'projectsApi.ts',
  gamificationApi: 'gamificationApi.ts',
  patrimonyApi: 'patrimonyApi.ts',
  membersApi: 'familyApi.ts',
  familyApi: 'familyApi.ts',
  invitesApi: 'familyApi.ts',
  authApi: 'authApi.ts',
  planApi: 'planApi.ts',
  preferencesApi: 'preferencesApi.ts',
  whatsappApi: 'whatsappApi.ts',
  importsApi: 'importsApi.ts',
  adminApi: 'adminApi.ts',
  feedbackApi: 'feedbackApi.ts',
}

const buckets = new Map()
for (const block of apiBlocks) {
  const file = fileFor[block.name] || `${block.name}.ts`
  if (!buckets.has(file)) buckets.set(file, [])
  buckets.get(file).push(block.text)
  console.log('api', block.name, '→', file)
}

for (const [file, blocks] of buckets) {
  const body = `import { apiBlob, apiFetch, apiFormData } from '../client'\n${typeImport}\n${blocks.join('\n\n')}\n`
  fs.writeFileSync(`${dir}/${file}`, body)
}

const files = [...buckets.keys()].map((f) => f.replace(/\.ts$/, ''))
fs.writeFileSync(
  `${dir}/index.ts`,
  `export type * from './types'\n${files.map((f) => `export * from './${f}'`).join('\n')}\n`,
)
fs.writeFileSync('d:/Projetos/Onra/Conora-frontEnd/src/api/finance.ts', `export * from './finance/index'\n`)
fs.writeFileSync(srcPath, `/** @deprecated Use '../api/finance' */\nexport * from './index'\n`)
console.log('types', typeNames.length, 'files', files.length)
