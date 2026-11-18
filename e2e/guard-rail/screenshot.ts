import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { expect, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

const require = createRequire(import.meta.url)
const { getComparator } = require('playwright-core/lib/coreBundle').utils as {
  getComparator: (
    mimeType: string,
  ) => (actual: Buffer, expected: Buffer, options: { maxDiffPixels: number; threshold: number }) => { errorMessage: string } | null
}

const compare = getComparator('image/png')

type Box = { x: number; y: number; width: number; height: number }

function paint(png: PNG, box: Box) {
  const x0 = Math.max(0, Math.floor(box.x) - 2)
  const y0 = Math.max(0, Math.floor(box.y) - 2)
  const x1 = Math.min(png.width, Math.ceil(box.x + box.width) + 2)
  const y1 = Math.min(png.height, Math.ceil(box.y + box.height) + 2)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (png.width * y + x) << 2
      png.data[i] = 255
      png.data[i + 1] = 0
      png.data[i + 2] = 255
      png.data[i + 3] = 255
    }
  }
}

function onlyIgnoredDiffers(actual: Buffer, expected: Buffer, boxes: Box[]): boolean {
  if (boxes.length === 0) return false
  const actualPng = PNG.sync.read(actual)
  const expectedPng = PNG.sync.read(expected)
  for (const box of boxes) {
    paint(actualPng, box)
    paint(expectedPng, box)
  }
  const result = compare(PNG.sync.write(actualPng), PNG.sync.write(expectedPng), {
    maxDiffPixels: 0,
    threshold: 0.2,
  })
  return result === null
}

export async function settleGuardChrome(page: Page) {
  await expect(page.getByRole('img', { name: /Ian ·/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Alertas, \d+ não lidos/ })).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.load("500 16px 'Be Vietnam Pro'")
    await document.fonts.load("600 17px 'Be Vietnam Pro'")
    await document.fonts.ready
  })
}

// Official exceptions, never a failure when the pixel diff stays inside them:
// the version stamp ([data-app-version]) and the operator Console shortcut
// ([data-guard-ignore]). Geometry drops the same nodes in geometry.ts.
export async function expectGuardScreenshot(page: Page, surface: string, name: string) {
  const ignored = page.locator('[data-app-version], [data-guard-ignore]')
  const boxes: Box[] = []
  for (let i = 0; i < await ignored.count(); i++) {
    const box = await ignored.nth(i).boundingBox()
    if (box && box.width > 0 && box.height > 0) boxes.push(box)
  }
  try {
    await expect(page).toHaveScreenshot(name, { fullPage: false })
  } catch (error) {
    if (boxes.length === 0) throw error
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('toHaveScreenshot')) throw error
    const expectedPath = path.join(process.cwd(), 'e2e', 'guard-rail', 'baselines', surface, name)
    const actual = await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide', scale: 'css' })
    if (!onlyIgnoredDiffers(actual, readFileSync(expectedPath), boxes)) throw error
  }
}
