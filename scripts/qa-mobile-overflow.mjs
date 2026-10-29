/**
 * Mobile horizontal overflow QA for Conora pages.
 * Usage: node scripts/qa-mobile-overflow.mjs [baseUrl] [email] [password]
 */
import { chromium } from 'playwright'

const baseUrl = (process.argv[2] ?? 'http://localhost:5175/app').replace(/\/$/, '')
const email = process.argv[3] ?? ''
const password = process.argv[4] ?? ''
const accessToken = process.env.CONORA_ACCESS_TOKEN ?? ''
const refreshToken = process.env.CONORA_REFRESH_TOKEN ?? ''
const WIDTH = 390
const HEIGHT = 844

const PUBLIC = [
  '/login',
  '/register',
  '/recuperar-senha',
  '/apresentacao',
  '/apresentacao/1',
  '/apresentacao/2',
  '/apresentacao/3',
  '/apresentacao/4',
]

const AUTHED = [
  '/',
  '/lancamentos',
  '/raio-x',
  '/orcamento',
  '/contas',
  '/projetos',
  '/relatorios',
  '/jornada',
  '/marcos',
  '/retrospectiva',
  '/diagnostico',
  '/categorias',
  '/patrimonio',
  '/membros',
  '/plano',
  '/plano/contrato',
  '/ajuda',
  '/perfil',
  '/configuracoes',
  '/whatsapp',
  '/importar',
  '/mes',
]

async function probe(page, deviceWidth) {
  return page.evaluate((deviceWidth) => {
    const inner = window.innerWidth
    const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    const offenders = []
    // Compare against the intended device width, not a window that grew with content.
    if (scrollW > deviceWidth + 1 || inner > deviceWidth + 1) {
      for (const el of document.querySelectorAll('body *')) {
        if (!(el instanceof HTMLElement)) continue
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        if (r.right > deviceWidth + 1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
            left: Math.round(r.left),
            right: Math.round(r.right),
            w: Math.round(r.width),
          })
          if (offenders.length >= 10) break
        }
      }
    }
    return {
      path: location.pathname.replace(/^\/app/, '') || '/',
      vw: inner,
      deviceWidth,
      scrollW,
      overflow: scrollW > deviceWidth + 1 || inner > deviceWidth + 1,
      offenders,
    }
  }, deviceWidth)
}

async function visit(page, path) {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT })
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.setViewportSize({ width: WIDTH, height: HEIGHT })
  await page.waitForTimeout(1200)
  // Wait out short return splash if it still mounts.
  await page.waitForFunction(() => !document.querySelector('[data-leaving]'), null, { timeout: 4000 }).catch(() => undefined)
  await page.waitForTimeout(400)
  await page.setViewportSize({ width: WIDTH, height: HEIGHT })
  return probe(page, WIDTH)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()

const results = []
for (const path of PUBLIC) {
  try {
    results.push(await visit(page, path))
  } catch (error) {
    results.push({ path, overflow: true, error: String(error) })
  }
}

async function seedSession() {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  if (accessToken && refreshToken) {
    await page.evaluate(
      ([access, refresh]) => {
        sessionStorage.setItem('conora.accessToken', access)
        localStorage.setItem('conora.refreshToken', refresh)
        localStorage.setItem('conora.seenHome', '1')
      },
      [accessToken, refreshToken],
    )
    return true
  }
  if (email && password) {
    await page.getByLabel(/CPF ou e-mail/i).fill(email)
    await page.getByLabel(/^Senha$/i).fill(password)
    await page.getByRole('button', { name: /^Entrar$/i }).click()
    await page.waitForTimeout(2500)
    return true
  }
  return false
}

if (await seedSession()) {
  for (const path of AUTHED) {
    try {
      results.push(await visit(page, path))
    } catch (error) {
      results.push({ path, overflow: true, error: String(error) })
    }
  }
}

await browser.close()

const bad = results.filter((r) => r.overflow || r.error)
console.log(JSON.stringify({ total: results.length, bad: bad.length, results }, null, 2))
process.exit(bad.length ? 1 : 0)
