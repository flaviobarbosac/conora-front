/**
 * Rewrite *Api.ts imports to only what each file actually references.
 */
import fs from 'fs'
import path from 'path'

const dir = 'd:/Projetos/Onra/Conora-frontEnd/src/api/finance'
const typesSrc = fs.readFileSync(path.join(dir, 'types.ts'), 'utf8')
const typeNames = [...typesSrc.matchAll(/^export type (\w+)/gm)].map((m) => m[1])
const typeSet = new Set(typeNames)

const clientSymbols = ['apiFetch', 'apiBlob', 'apiFormData']
const helperSymbols = ['query', 'json', 'entryDisplayDescription']

for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith('Api.ts')) continue
  const filePath = path.join(dir, name)
  let text = fs.readFileSync(filePath, 'utf8')

  // Strip existing imports from ../client, ./types, ./helpers
  text = text.replace(/^import\s+\{[^}]+\}\s+from\s+'[^']+'\s*\n/gm, (block) => {
    if (/from\s+'\.\.\/client'|from\s+'\.\/types'|from\s+'\.\/helpers'/.test(block)) {
      return ''
    }
    return block
  })
  // multi-line type imports
  text = text.replace(/^import\s+type\s+\{[\s\S]*?\}\s+from\s+'\.\/types'\s*\n/gm, '')
  text = text.replace(/^import\s+\{[\s\S]*?\}\s+from\s+'\.\.\/client'\s*\n/gm, '')
  text = text.replace(/^import\s+\{[\s\S]*?\}\s+from\s+'\.\/helpers'\s*\n/gm, '')

  const body = text
  const usedTypes = typeNames.filter((t) => new RegExp(`\\b${t}\\b`).test(body))
  const usedClient = clientSymbols.filter((s) => new RegExp(`\\b${s}\\b`).test(body))
  const usedHelpers = helperSymbols.filter((s) => new RegExp(`\\b${s}\\b`).test(body))

  const lines = []
  if (usedClient.length) {
    lines.push(`import { ${usedClient.join(', ')} } from '../client'`)
  }
  if (usedHelpers.length) {
    lines.push(`import { ${usedHelpers.join(', ')} } from './helpers'`)
  }
  if (usedTypes.length) {
    lines.push(`import type {\n  ${usedTypes.join(',\n  ')},\n} from './types'`)
  }
  lines.push('')
  const next = `${lines.join('\n')}${text.replace(/^\s+/, '')}`
  fs.writeFileSync(filePath, next)
  console.log(name, {
    client: usedClient.length,
    helpers: usedHelpers.length,
    types: usedTypes.length,
  })
}
