/**
 * Move feature-scoped rules from page.module.css into feature CSS modules.
 * Matching: top-level selectors whose first local class matches a prefix.
 */
import fs from 'fs'

const pages = 'd:/Projetos/Onra/Conora-frontEnd/src/pages'
const pageCssPath = `${pages}/page.module.css`
let css = fs.readFileSync(pageCssPath, 'utf8')

/** @type {{ file: string, prefixes: string[], ensureDir?: string }[]} */
const extractions = [
  {
    file: 'raioX/raioX.module.css',
    prefixes: ['leakage', 'periodSlider', 'heroCardsRaioX'],
  },
  {
    file: 'marcos/marcos.module.css',
    prefixes: ['marco'],
    ensureDir: 'marcos',
  },
  {
    file: 'members/members.module.css',
    prefixes: ['invite', 'membersRow'],
    ensureDir: 'members',
  },
  {
    file: 'onboarding/onboarding.module.css',
    prefixes: ['journey', 'onboarding'],
    ensureDir: 'onboarding',
  },
  {
    file: 'settings/settings.module.css',
    prefixes: ['settingsForm'],
    ensureDir: 'settings',
  },
]

function firstLocalClass(selector) {
  const m = selector.match(/\.([A-Za-z_][\w-]*)/)
  return m ? m[1] : null
}

function matchesPrefixes(selector, prefixes) {
  // Split comma-separated selectors; all parts must match a prefix (or none have local class)
  const parts = selector.split(',').map((s) => s.trim())
  return parts.every((part) => {
    const cls = firstLocalClass(part)
    if (!cls) return false
    return prefixes.some((p) => cls === p || cls.startsWith(p))
  })
}

/** Parse top-level rules (including @media wrapping). */
function parseTopRules(text) {
  const rules = []
  let i = 0
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++
    if (i >= text.length) break
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2)
      const next = end < 0 ? text.length : end + 2
      rules.push({ kind: 'comment', text: text.slice(i, next) })
      i = next
      continue
    }
    if (text[i] === '@') {
      // @media ... { ... } or @keyframes etc.
      const brace = text.indexOf('{', i)
      if (brace < 0) break
      let d = 0
      let j = brace
      for (; j < text.length; j++) {
        if (text[j] === '{') d++
        else if (text[j] === '}') {
          d--
          if (d === 0) {
            j++
            break
          }
        }
      }
      rules.push({ kind: 'at', text: text.slice(i, j) })
      i = j
      continue
    }
    // normal rule: selectors { body }
    const brace = text.indexOf('{', i)
    if (brace < 0) {
      rules.push({ kind: 'other', text: text.slice(i) })
      break
    }
    let d = 0
    let j = brace
    for (; j < text.length; j++) {
      if (text[j] === '{') d++
      else if (text[j] === '}') {
        d--
        if (d === 0) {
          j++
          break
        }
      }
    }
    const selector = text.slice(i, brace).trim()
    rules.push({ kind: 'rule', selector, text: text.slice(i, j) })
    i = j
  }
  return rules
}

function splitAtRule(atText, prefixes) {
  // @media query { inner rules }
  const brace = atText.indexOf('{')
  const header = atText.slice(0, brace + 1)
  const inner = atText.slice(brace + 1, atText.lastIndexOf('}'))
  const innerRules = parseTopRules(inner)
  const keep = []
  const move = []
  for (const r of innerRules) {
    if (r.kind === 'rule' && matchesPrefixes(r.selector, prefixes)) move.push(r.text)
    else if (r.kind === 'comment' && move.length && !keep.length) move.push(r.text)
    else keep.push(r.text)
  }
  if (!move.length) return { keep: atText, move: null }
  if (!keep.filter((t) => t.trim() && !t.trim().startsWith('/*')).length) {
    // entire at-rule moves
    return { keep: null, move: atText }
  }
  return {
    keep: `${header}\n${keep.join('\n')}\n}`,
    move: `${header}\n${move.join('\n')}\n}`,
  }
}

for (const spec of extractions) {
  if (spec.ensureDir) {
    const d = `${pages}/${spec.ensureDir}`
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  }
  const targetPath = `${pages}/${spec.file}`
  let existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : ''
  const rules = parseTopRules(css)
  const keep = []
  const moved = []
  for (const r of rules) {
    if (r.kind === 'rule' && matchesPrefixes(r.selector, spec.prefixes)) {
      moved.push(r.text)
      continue
    }
    if (r.kind === 'at' && r.text.startsWith('@media')) {
      const split = splitAtRule(r.text, spec.prefixes)
      if (split.move) moved.push(split.move)
      if (split.keep) keep.push(split.keep)
      continue
    }
    keep.push(r.text)
  }
  if (!moved.length) {
    console.log(spec.file, 'nothing to move')
    continue
  }
  css = keep.join('\n\n') + '\n'
  const block = `\n/* --- extracted from page.module.css --- */\n${moved.join('\n\n')}\n`
  fs.writeFileSync(targetPath, existing.trimEnd() + '\n' + block)
  console.log(spec.file, 'moved', moved.length, 'chunks')
}

fs.writeFileSync(pageCssPath, css)
const pageLines = css.split(/\n/).length
console.log('page.module.css lines now', pageLines)
