import { expect, test, type Page } from '@playwright/test'
import {
  cents,
  entrySensitization,
  formatCents,
  formatMoney,
  numberFromCents,
  rootRollups,
  sectionProblems,
  type BudgetPayload,
  type EntryRow,
} from './guard-rail/money'
import {
  collectGeometry,
  diffGeometry,
  geometryPath,
  readGeometry,
  writeGeometry,
} from './guard-rail/geometry'

const API = 'http://127.0.0.1:5080'

const screens = [
  { id: 'orcamento', path: 'orcamento', title: 'Orçamento' },
  { id: 'raio-x', path: 'raio-x', title: 'Raio-X' },
  { id: 'lancamentos', path: 'lancamentos', title: 'Lançamentos' },
] as const

function competence(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

function token(): string {
  const value = process.env.GUARD_RAIL_ACCESS_TOKEN
  if (!value) throw new Error('Rode npm run guard-rail. Este teste só entra com o token do localhost.')
  return value
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  if (!response.ok) {
    throw new Error(`${path} respondeu ${response.status} no localhost`)
  }
  return (await response.json()) as T
}

async function openScreen(page: Page, path: string, title: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript((accessToken) => {
    localStorage.setItem('conora.knownAccount', '1')
    localStorage.setItem('conora.seenHome', '1')
    sessionStorage.setItem('conora.accessToken', accessToken)
    const style = document.createElement('style')
    style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'
    document.documentElement.appendChild(style)
  }, token())
  await page.goto(path)
  await expect(page.getByText('Vivendo bem o presente, planejando um futuro melhor.')).toHaveCount(0)
  const heading = page.getByRole('heading', { name: title, exact: true })
  try {
    await expect(heading).toBeVisible()
  } catch {
    throw new Error(`${title} não abriu. A URL ficou ${page.url()}`)
  }
  if (title === 'Orçamento') await expect(page.getByText('Buscar categoria')).toBeVisible()
  if (title === 'Raio-X') await expect(page.getByText('Saldo do mês')).toBeVisible()
  if (title === 'Lançamentos') {
    await expect(page.locator('body')).toContainText(/R\$\s*\d|Nenhum lançamento/i)
  }
  await page.evaluate(() => document.fonts.ready)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  )
  if (overflow) throw new Error('a tela passou da largura')
}

function shownPercent(actual: bigint, planned: bigint): string {
  if (planned <= 0n) return '0,0'
  return ((Number(actual) / Number(planned)) * 100).toFixed(1).replace('.', ',')
}

function visibleText(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, ' ')
}

async function expectMoney(page: Page, value: number, label: string) {
  const body = visibleText(await page.locator('body').innerText())
  const expected = visibleText(formatMoney(value))
  if (!body.includes(expected)) {
    throw new Error(`${label}: a tela não mostra ${expected} (esperado ${formatCents(cents(value))})`)
  }
}

function assertGeometry(surface: string, screen: string, boxes: { name: string; x: number; y: number; w: number; h: number }[]) {
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

for (const screen of screens) {
  test(screen.title, async ({ page }, testInfo) => {
    const surface = testInfo.project.name
    const ym = competence()
    const budget = await api<BudgetPayload>(`/budgets/${ym}`)
    const categories = await api<{ id: string; parentId: string | null; name: string; level: string }[]>('/categories')

    if (screen.id === 'orcamento') {
      const problems = sectionProblems(budget)
      if (problems.length > 0) throw new Error(problems.slice(0, 6).join('\n'))
    }
    if (screen.id === 'lancamentos') {
      const pageResult = await api<{ items: EntryRow[]; totalCount: number }>(`/entries?competenceYm=${ym}&take=500`)
      if (pageResult.totalCount > pageResult.items.length) {
        throw new Error(`o mês tem ${pageResult.totalCount} lançamentos e a consulta trouxe ${pageResult.items.length}`)
      }
      const problems = entrySensitization(budget.lines, pageResult.items)
      if (problems.length > 0) throw new Error(problems.slice(0, 6).join('\n'))
    }

    await openScreen(page, screen.path, screen.title)

    const portrait = surface === 'mobile-portrait'
    if (screen.id === 'orcamento') {
      const roots = rootRollups(budget.lines, categories).sort((a, b) => (a.planned > b.planned ? -1 : 1))
      const top = roots[0]
      if (!top) throw new Error('nenhuma conta sintética com valor no orçamento')
      const body = visibleText(await page.locator('body').innerText())
      for (const root of roots) {
        if (!body.includes(root.name)) throw new Error(`a tela não mostra a conta ${root.name}`)
      }
      if (!portrait) await expectMoney(page, numberFromCents(top.planned), top.name)
    }
    if (screen.id === 'raio-x') {
      const top = rootRollups(budget.lines, categories).sort((a, b) => (a.actual > b.actual ? -1 : 1))[0]
      if (!top) throw new Error('nenhuma conta sintética com valor para o Raio-X')
      await expectMoney(page, budget.monthResult, 'resultado do mês')
      const body = visibleText(await page.locator('body').innerText())
      if (!body.includes(top.name)) throw new Error(`o Raio-X não mostra a conta ${top.name}`)
      if (portrait) {
        const percent = shownPercent(top.actual, top.planned)
        const name = top.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        await expect(page.getByRole('button', { name: new RegExp(`${name}.*${percent}`) })).toBeVisible()
      } else {
        await expectMoney(page, numberFromCents(top.actual), top.name)
      }
    }
    if (screen.id === 'lancamentos') {
      const pageResult = await api<{ items: EntryRow[] }>(`/entries?competenceYm=${ym}&take=500`)
      const sample = pageResult.items.find((entry) => entry.type === 'Expense')
      if (!sample) throw new Error('não há despesa no mês para conferir a tela de lançamentos')
      const body = visibleText(await page.locator('body').innerText())
      if (!body.includes(sample.description)) {
        throw new Error(`a tela não mostra o lançamento ${sample.description}`)
      }
      await expectMoney(page, Math.abs(sample.amount), sample.description)
    }

    const boxes = await page.evaluate(collectGeometry)
    assertGeometry(surface, screen.id, boxes)
    await expect(page).toHaveScreenshot(`${screen.id}.png`, { fullPage: false })
  })
}
