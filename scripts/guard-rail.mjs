import { createHmac } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backend = path.resolve(root, '..', 'Conora-backEnd')
const email = 'flavio.barbosa.vix@gmail.com'
const reportPath = path.join(root, 'e2e', 'guard-rail-report.json')

const suites = []

function fail(name, detail) {
  suites.push({ name, ok: false, detail })
}

function pass(name) {
  suites.push({ name, ok: true })
}

function writeReport() {
  const broken = suites.find((suite) => !suite.ok)
  const verdict = broken ? 'nao-pode-seguir' : 'ok'
  const report = {
    verdict,
    email,
    environment: 'localhost',
    suites,
  }
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  if (verdict === 'ok') {
    console.log('ok, pode seguir')
    return
  }
  console.log('não pode seguir')
  console.log(broken.detail)
}

function assertLocalSettings() {
  const file = path.join(backend, 'src', 'Conora.Api', 'appsettings.Development.json')
  const settings = JSON.parse(readFileSync(file, 'utf8'))
  const connection = String(settings.ConnectionStrings?.Postgres ?? '')
  const host = connection.match(/Host=([^;]+)/i)?.[1] ?? ''
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('O guard rail só roda com o Postgres em localhost.')
  }
  const raw = execFileSync('docker', ['inspect', 'conora-postgres'], { encoding: 'utf8' })
  const info = JSON.parse(raw)[0]
  if (info.State.Status !== 'running') {
    throw new Error('O container conora-postgres não está rodando.')
  }
  const binds = info.NetworkSettings.Ports?.['5432/tcp'] ?? []
  for (const bind of binds) {
    if (!['0.0.0.0', '127.0.0.1', '::', ''].includes(bind.HostIp)) {
      throw new Error(`Porta do Postgres publicada fora do localhost (${bind.HostIp}).`)
    }
  }
  return settings.Jwt.Key
}

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', 'conora-postgres', 'psql', '-U', 'conora', '-d', 'conora', '-t', '-A', '-c', sql],
    { encoding: 'utf8' },
  ).trim()
}

function userId() {
  const id = psql(
    `SELECT "Id" FROM users WHERE lower("Email") = '${email}' AND "DeletedAt" IS NULL`,
  )
  if (!id) throw new Error(`Usuário ${email} não está no Postgres local.`)
  return id
}

function seedIfEmpty() {
  const count = psql(
    `SELECT count(*) FROM entries WHERE "UsuarioId" = '${userId()}' AND "DeletedAt" IS NULL`,
  )
  if (count !== '0') return
  const seed = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(backend, 'scripts', 'guard-rail', 'seed.ps1')],
    { stdio: 'inherit' },
  )
  if (seed.status !== 0) throw new Error('O seed local falhou. O guard rail não rodou em outro ambiente.')
}

function signToken(jwtKey, id) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    sub: id,
    email,
    iss: 'conora-api',
    aud: 'conora-app',
    iat: now,
    nbf: now,
    exp: now + 20 * 60,
  })).toString('base64url')
  const data = `${header}.${payload}`
  const signature = createHmac('sha256', jwtKey).update(data).digest('base64url')
  return `${data}.${signature}`
}

function run(name, command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...extraEnv },
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.status === 0) {
    pass(name)
    return
  }
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`.trim()
  const tail = text.split(/\r?\n/).slice(-40).join('\n')
  fail(name, tail || `${name} falhou`)
}

function playwrightFailures() {
  try {
    const raw = JSON.parse(readFileSync(path.join(root, 'e2e', 'guard-rail-playwright.json'), 'utf8'))
    const lines = []
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          for (const result of test.results ?? []) {
            if (result.status === 'passed') continue
            const project = test.projectName ?? result.projectName ?? ''
            const message = result.error?.message?.split('\n')[0] ?? result.status
            lines.push(`${spec.title} (${project}): ${message.replace(/\u001b\[[0-9;]*m/g, '')}`)
          }
        }
      }
      for (const child of suite.suites ?? []) walk(child)
    }
    walk(raw)
    return lines
  } catch {
    return []
  }
}

try {
  const jwtKey = assertLocalSettings()
  seedIfEmpty()

  const health = await fetch('http://127.0.0.1:5080/health/live')
  if (!health.ok) throw new Error('A API local em localhost:5080 não respondeu.')

  run('backend-unit', 'dotnet', [
    'test',
    path.join(backend, 'tests', 'Conora.UnitTests', 'Conora.UnitTests.csproj'),
    '--nologo',
  ])
  run('frontend-unit', process.execPath, [path.join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run'])
  const accessToken = signToken(jwtKey, userId())
  const baselineDir = path.join(root, 'e2e', 'guard-rail', 'baselines')
  const hasBaseline = existsSync(baselineDir)
    && readdirSync(baselineDir, { recursive: true }).some((name) => String(name).endsWith('.png'))
  run(
    'playwright',
    process.execPath,
    [path.join(root, 'node_modules', '@playwright', 'test', 'cli.js'), 'test', '-c', 'playwright.guard-rail.config.ts'],
    {
      GUARD_RAIL_ACCESS_TOKEN: accessToken,
      GUARD_RAIL_UPDATE_BASELINES: process.env.GUARD_RAIL_UPDATE_BASELINES === '1' || !hasBaseline ? '1' : '0',
    },
  )
  if (suites.at(-1)?.name === 'playwright' && !suites.at(-1).ok) {
    const lines = playwrightFailures()
    if (lines.length > 0) suites.at(-1).detail = lines.join('\n')
  }
} catch (error) {
  fail('ambiente', error instanceof Error ? error.message : String(error))
}

writeReport()
if (suites.some((suite) => !suite.ok)) process.exit(1)
