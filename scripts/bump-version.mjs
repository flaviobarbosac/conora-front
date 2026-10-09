import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const parts = String(pkg.version).split('.').map(Number)
if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
  console.error(`Invalid semver in package.json: ${pkg.version}`)
  process.exit(1)
}

parts[2] += 1
pkg.version = parts.join('.')

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
console.log(`Version bumped to ${pkg.version}`)
