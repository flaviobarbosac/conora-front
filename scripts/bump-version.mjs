import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const parts = String(pkg.version).split('.').map(Number)
if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
  console.error(`Invalid version in package.json: ${pkg.version}`)
  process.exit(1)
}

const year = new Date().getFullYear()
const [versionYear, minor, patch] = parts

if (versionYear !== year) {
  // New calendar year: YEAR.1.0
  pkg.version = `${year}.1.0`
} else {
  pkg.version = `${year}.${minor}.${patch + 1}`
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
console.log(`Version bumped to ${pkg.version}`)
