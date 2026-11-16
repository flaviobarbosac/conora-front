import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  collectGeometry,
  diffGeometry,
  geometryPath,
  readGeometry,
  writeGeometry,
} from './guard-rail/geometry'
import { expectGuardScreenshot, settleGuardChrome } from './guard-rail/screenshot'

const API = 'http://127.0.0.1:5080'
const YM = '2026-09'
const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'extrato-inter-2026-09.pdf',
)

function token(): string {
  const value = process.env.GUARD_RAIL_ACCESS_TOKEN
  if (!value) throw new Error('Rode npm run guard-rail. Este teste só entra com o token do localhost.')
  return value
}

async function api<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(init?.headers ?? {}),
    },
  })
  if (response.status === 204) {
    return undefined as T
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${pathname} respondeu ${response.status}: ${body.slice(0, 240)}`)
  }
  if (response.headers.get('content-type')?.includes('application/json')) {
    return (await response.json()) as T
  }
  return undefined as T
}

async function ensureMonthOpen() {
  const status = await api<{ isClosed: boolean }>(`/months/${YM}`)
  if (status.isClosed) {
    await api(`/months/${YM}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'guard-rail extrato' }),
    })
  }
}

async function discardOpenBatch() {
  const open = await api<{ batchId: string } | null | undefined>(
    `/imports/open?competenceYm=${encodeURIComponent(YM)}`,
  )
  if (open?.batchId) {
    await api(`/imports/${open.batchId}/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  }
}

async function openExtrato(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript((accessToken) => {
    localStorage.setItem('conora.knownAccount', '1')
    localStorage.setItem('conora.seenHome', '1')
    sessionStorage.setItem('conora.accessToken', accessToken)
    const style = document.createElement('style')
    style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'
    document.documentElement.appendChild(style)
  }, token())
  await page.goto(`lancamentos/extrato?mes=${YM}`)
  await expect(page.getByRole('heading', { name: 'Extrato bancário', exact: true })).toBeVisible()
  await expect(page.getByText(`Competência ${YM}`)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  )
  if (overflow) throw new Error('a tela passou da largura')
}

function assertScreenGeometry(
  surface: string,
  screen: string,
  boxes: { name: string; x: number; y: number; w: number; h: number }[],
) {
  const file = geometryPath(surface, screen)
  if (process.env.GUARD_RAIL_UPDATE_BASELINES === '1') {
    writeGeometry(file, boxes)
    return
  }
  const baseline = readGeometry(file)
  if (!baseline) throw new Error(`baseline de posição ausente para ${screen} em ${surface}`)
  const problems = diffGeometry(baseline, boxes)
  if (problems.length > 0) {
    throw new Error(problems.slice(0, 6).join('\n'))
  }
}

async function capture(page: Page, surface: string, screen: string) {
  await settleGuardChrome(page)
  const boxes = await page.evaluate(collectGeometry)
  assertScreenGeometry(surface, screen, boxes)
  await expectGuardScreenshot(page, surface, `${screen}.png`)
}

test.describe('extrato', () => {
  test('boot, resumo e classificação com geometria', async ({ page }, testInfo) => {
    const surface = testInfo.project.name
    await ensureMonthOpen()
    await discardOpenBatch()
    await openExtrato(page)

    await expect(page.getByRole('button', { name: 'Enviar extrato bancário' })).toBeVisible()
    await capture(page, surface, 'extrato-boot')

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE)

    const summary = page.getByText(/\d+\s+já lançados\.\s*\d+\s+para classificar/i)
    const supportCta = page.getByRole('button', { name: 'Abrir Feedback' })
    const account = page.getByRole('heading', { name: 'Conta do extrato', exact: true })

    await expect(summary.or(supportCta).or(account)).toBeVisible({ timeout: 60_000 })

    if (await supportCta.isVisible().catch(() => false)) {
      await expect(page.getByText(/Não foi possível identificar|Suporte Técnico/i)).toBeVisible()
      await capture(page, surface, 'extrato-support')
      return
    }

    if (await account.isVisible().catch(() => false)) {
      await capture(page, surface, 'extrato-account')
      const select = page.locator('select[name="statementAccount"]')
      const options = select.locator('option')
      const count = await options.count()
      if (count > 1) {
        await select.selectOption({ index: 1 })
        await page.getByRole('button', { name: 'Usar esta conta' }).click()
      } else {
        await page.getByRole('button', { name: 'Cadastrar conta do extrato' }).click()
        await page.getByRole('button', { name: 'Sim, cadastrar' }).click()
      }
      await expect(summary.or(page.getByText(/^\d+\/\d+/))).toBeVisible({ timeout: 60_000 })
    }

    if (await summary.isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: /Classificar os \d+/i })).toBeVisible()
      await capture(page, surface, 'extrato-summary')
      await page.getByRole('button', { name: /Classificar os \d+/i }).click()
    }

    const done = page.getByText('Extrato tratado por completo.')
    const next = page.getByRole('button', { name: 'Próximo' })
    await expect(done.or(next)).toBeVisible({ timeout: 60_000 })

    if (await done.isVisible().catch(() => false)) {
      await capture(page, surface, 'extrato-done')
      return
    }

    await expect(next).toBeVisible()
    await capture(page, surface, 'extrato-classify')
  })
})
