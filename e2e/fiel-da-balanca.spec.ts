import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * Immutable witness for the main product.
 * Setup grants the Duo plan (Family monthly) on the local Development API.
 * Every later step goes through the screens.
 */

const MONTHS = [
  { ym: '2026-11', date: '2026-11-15', cents: '1000', amount: 10 },
  { ym: '2026-12', date: '2026-12-15', cents: '2000', amount: 20 },
  { ym: '2027-01', date: '2027-01-15', cents: '3000', amount: 30 },
] as const

const BOLETO_LINE = '34191.79001 01043.510047 91020.150008 1 84660000020000'
const BOLETO_AMOUNT = '200,00'

type Leaf = { name: string; group: string }

function mark(step: string) {
  appendFileSync(path.join(process.cwd(), 'e2e', 'fiel-progress.log'), `${new Date().toISOString()} ${step}\n`)
}

function cpfCheckDigit(digits: number[], weightStart: number): number {
  const sum = digits.reduce((total, digit, index) => total + digit * (weightStart - index), 0)
  const mod = sum % 11
  return mod < 2 ? 0 : 11 - mod
}

function newCpf(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits.every((digit) => digit === digits[0])) {
    digits[8] = (digits[8] + 1) % 10
  }
  const d1 = cpfCheckDigit(digits, 10)
  const d2 = cpfCheckDigit([...digits, d1], 11)
  const raw = [...digits, d1, d2].join('')
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`
}

function moneyLabel(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

async function grantDuo(page: Page) {
  const token = await page.evaluate(() => sessionStorage.getItem('conora.accessToken'))
  expect(token, 'sessão depois do cadastro').toBeTruthy()
  const response = await page.request.post('http://localhost:5175/plan/subscribe', {
    data: { plan: 'FamilyMonthly', storePurchaseToken: 'fiel-da-balanca-duo' },
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  const plan = (await response.json()) as { phase: string; tier: string }
  expect(plan.phase).toBe('Subscribed')
  expect(plan.tier).toBe('Family')
  await page.reload()
}

async function pickCategory(page: Page, leaf: Leaf) {
  await page.locator('#categoryId').click()
  await page.getByLabel('Buscar em Categoria').fill(leaf.name)
  const option = page
    .getByRole('group', { name: leaf.group })
    .getByRole('button', { name: leaf.name, exact: true })
  await option.click()
  await expect(page.locator('#categoryId')).toContainText(leaf.name)
}

async function expandRaioX(page: Page) {
  for (let guard = 0; guard < 500; guard += 1) {
    const closed = page.locator('#raiox-arvore button[aria-expanded="false"]').first()
    if ((await closed.count()) === 0) return
    await closed.locator('span').first().click()
  }
  throw new Error('A árvore do Raio-X não abriu por completo.')
}

async function raioRows(page: Page): Promise<{ name: string; actual: number }[]> {
  return page.locator('#raiox-arvore button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const name = button.querySelector('strong')?.textContent?.trim() ?? ''
      const text = button.textContent ?? ''
      const values = [...text.matchAll(/R\$\s*[\d.]+,\d{2}/g)].map((match) => {
        const normalized = match[0].replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.')
        return Number(normalized)
      })
      const actual = values.length === 0 ? 0 : values.length === 1 ? values[0] : values[1]
      return { name, actual }
    }),
  )
}

test('fiel da balança: conta nova no Duo, lançamentos, Raio-X, boleto e cadastros', async ({ page }) => {
  test.setTimeout(45 * 60 * 1000)
  const email = `fiel-${Date.now()}@example.com`
  const password = 'senha-segura'
  const cpf = newCpf()

  await test.step('cadastro da conta', async () => {
    mark('cadastro')
    await page.goto('register')
    await page.getByLabel('Nome').fill('Conta Fiel')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('CPF').fill(cpf)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByLabel('Confirmar senha').fill(password)
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao Conora' })).toBeVisible()
  })

  await test.step('onboarding: telefone, CEP, conta e diagnóstico', async () => {
    mark('onboarding')
    await page.getByLabel('Telefone').fill('27999999999')
    await page.getByLabel('CEP').fill('29000000')
    await page.getByRole('button', { name: 'Salvar e continuar' }).click()
    await expect(page.getByLabel('Descrição')).toBeVisible()
    await page.getByLabel('Descrição').fill('Conta fiel')
    await expect.poll(async () => page.locator('select[name="bankCode"] option').count()).toBeGreaterThan(1)
    await page.locator('select[name="bankCode"]').selectOption({ index: 1 })
    await page.getByLabel('Agência').fill('0001')
    await page.getByLabel('Número da conta').fill('12345')
    await page.getByLabel('Dígito').fill('0')
    await page.getByRole('button', { name: 'Salvar conta e continuar' }).click()

    await page.getByRole('radiogroup', { name: /renda fixa/i }).getByText('Sim', { exact: true }).click()
    await page.getByRole('radiogroup', { name: /parcela de dívida/i }).getByText('Não', { exact: true }).click()
    await page.getByRole('radiogroup', { name: /patrimônio/i }).getByText('Sim', { exact: true }).click()
    await page.getByRole('radiogroup', { name: /projeto de vida/i }).getByText('Não', { exact: true }).click()
    await page.getByRole('button', { name: 'Salvar e continuar' }).click()
    await page.getByRole('button', { name: 'Concluir e entrar' }).click()
    await expect(page.getByRole('button', { name: 'Esconder' })).toBeVisible()
  })

  await test.step('plano Duo no setup, sem trial', async () => {
    mark('duo')
    await grantDuo(page)
    await expect(page.getByRole('button', { name: 'Esconder' })).toBeVisible()
  })

  await test.step('a jornada continua no perfil depois de sair e entrar', async () => {
    mark('jornada')
    await page.getByRole('button', { name: 'Menu do perfil' }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await page.goto('login')
    await page.getByLabel('CPF ou e-mail').fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Esconder' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Esconder' })).toBeVisible()
  })

  const leaves = await test.step('categorias liberadas pelo Duo', async () => {
    mark('categorias')
    await page.goto('lancamentos/novo')
    await page.locator('#categoryId').click()
    const collected = await page.locator('[role="listbox"]').evaluate((list) => {
      const locked = list.querySelectorAll('[role="option"] button[disabled]').length
      const items = [...list.querySelectorAll('[role="group"]')].flatMap((group) => {
        const groupName = group.getAttribute('aria-label') ?? ''
        return [...group.querySelectorAll('[role="option"] button:not([disabled])')].map((button) => ({
          name: (button.textContent ?? '').trim(),
          group: groupName,
        }))
      })
      return { locked, items }
    })
    expect(collected.locked, 'categoria ainda presa no trial').toBe(0)
    expect(collected.items.length).toBeGreaterThan(20)
    await page.locator('#categoryId').click()
    return collected.items.filter((item) => item.name.length > 0)
  })

  await test.step('despesas fictícias em novembro, dezembro e janeiro', async () => {
    mark(`lancamentos ${leaves.length}`)
    await page.locator('select[name="accountId"]').selectOption({ label: 'Conta fiel' })
    let posted = 0
    for (const leaf of leaves) {
      await pickCategory(page, leaf)
      for (const month of MONTHS) {
        await page.locator('input[name="amount"]').fill(month.cents)
        await page.locator('input[name="date"]').fill(month.date)
        await page.locator('input[name="description"]').fill('Fiel')
        const response = page.waitForResponse(
          (item) => item.url().includes('/entries') && item.request().method() === 'POST',
          { timeout: 20_000 },
        )
        await page.getByRole('button', { name: 'Salvar', exact: true }).click()
        const saved = await response
        expect(saved.ok(), await saved.text()).toBeTruthy()
        posted += 1
      }
      if (posted % 15 === 0) {
        mark(`lancamentos ${posted}`)
        console.log(`lançamentos ${posted}/${leaves.length * MONTHS.length}`)
      }
    }
    expect(posted).toBe(leaves.length * MONTHS.length)
  })

  await test.step('Raio-X confere o realizado de cada categoria', async () => {
    mark('raio-x')
    for (const month of MONTHS) {
      await page.goto(`raio-x?competenceYm=${month.ym}`)
      await expect(page.locator('#raiox-arvore')).toBeVisible()
      await expandRaioX(page)
      const rows = await raioRows(page)
      const expected = new Map<string, number>()
      for (const leaf of leaves) {
        expected.set(leaf.name, (expected.get(leaf.name) ?? 0) + 1)
      }
      for (const [name, count] of expected) {
        const hits = rows.filter((row) => row.name === name && Math.abs(row.actual - month.amount) < 0.001)
        expect(hits.length, `${name} em ${month.ym} deveria ser ${moneyLabel(month.amount)}`).toBe(count)
      }
    }
  })

  await test.step('boleto: enviar a foto e ler o valor', async () => {
    mark('boleto')
    const fixtureDir = path.join(process.cwd(), 'e2e', 'fixtures')
    mkdirSync(fixtureDir, { recursive: true })
    const image = path.join(fixtureDir, 'boleto-linha.png')
    const script = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1400, 280
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font 'Arial', 32
$brush = [System.Drawing.Brushes]::Black
$g.DrawString('${BOLETO_LINE}', $font, $brush, 24, 110)
$bmp.Save('${image.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`
    execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' })

    await page.goto('orcamento')
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Enviar Foto' }).click()
    await page.getByRole('button', { name: /Boleto/ }).click()
    await (await chooser).setFiles(image)
    await expect(page.getByRole('heading', { name: 'Classificar boleto' })).toBeVisible({ timeout: 90_000 })
    await expect(page.locator('input[name="receiptAmount"]')).toHaveValue(BOLETO_AMOUNT)
    await page.locator('input[name="receiptDueDate"]').fill('2026-11-20')
    await page.locator('input[name="receipt-category"]').first().check()
    await page.getByRole('button', { name: 'Salvar classificação' }).click()
    await expect(page.getByText('Despesa a pagar')).toBeVisible()
  })

  await test.step('cadastros: contas, categorias, marcos, projeto, patrimônio e membro', async () => {
    mark('cadastros')
    await page.goto('contas')
    await expect(page.getByText('Conta fiel', { exact: true })).toBeVisible()

    await page.goto('categorias')
    await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible()

    await page.goto('marcos')
    await expect(page.getByRole('heading', { name: 'Marcos' })).toBeVisible()

    await page.goto('projetos')
    await page.getByRole('button', { name: 'Novo projeto' }).click()
    await page.locator('input[name="projectName"]').fill('Reserva fiel')
    await page.locator('#projectCategory').click()
    await page.getByLabel('Buscar em Categoria').fill('a')
    await page.locator('[role="listbox"] [role="option"] button').first().click()
    await page.locator('input[name="projectGoal"]').fill('120000')
    await page.locator('input[name="projectStart"]').fill('2026-11')
    await page.locator('input[name="projectDue"]').fill('2027-11')
    await page.getByRole('button', { name: 'Criar projeto' }).click()
    await expect(page.getByText('Projeto criado')).toBeVisible()

    await page.goto('patrimonio')
    await page.getByRole('button', { name: 'Novo item' }).click()
    await page.locator('#patrimonyAccount').click()
    await page.locator('[role="listbox"] [role="option"] button').first().click()
    await page.locator('input[name="patrimonyName"]').fill('Bem fiel')
    await page.locator('input[name="patrimonyAmount"]').fill('50000')
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByText('Bem fiel', { exact: true })).toBeVisible()

    await page.goto('membros')
    const invite = `convidado-${Date.now()}@example.com`
    await page.locator('input[name="inviteEmail"]').fill(invite)
    await page.getByRole('button', { name: 'Enviar convite' }).click()
    await expect(page.getByText('Convite enviado.')).toBeVisible()
  })
})
