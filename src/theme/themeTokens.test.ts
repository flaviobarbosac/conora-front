import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_THEMES, normalizeThemeId, ThemeId } from './themes'

const TOKENS_PATH = resolve(__dirname, '../styles/tokens.css')

/** Relative luminance helpers for WCAG contrast (sRGB). */
function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b))
  const dark = Math.min(luminance(a), luminance(b))
  return (light + 0.05) / (dark + 0.05)
}

function readThemeBlock(css: string, themeId: string): string {
  const marker = `[data-theme='${themeId}']`
  const start = css.indexOf(marker)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

function readVar(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`))
  expect(match?.[1], name).toBeTruthy()
  return match![1]!.toLowerCase()
}

describe('theme catalog', () => {
  it('normalizes legacy light/dark ids', () => {
    expect(normalizeThemeId('light')).toBe(ThemeId.Clareza)
    expect(normalizeThemeId('dark')).toBe(ThemeId.Noite)
    expect(normalizeThemeId('salvia')).toBe(ThemeId.Salvia)
  })

  it('exposes all six climate themes without plan lock', () => {
    expect(ALL_THEMES).toHaveLength(6)
    expect(ALL_THEMES.every((theme) => !theme.requiresAnnual)).toBe(true)
  })
})

describe('theme tokens contrast AA', () => {
  const css = readFileSync(TOKENS_PATH, 'utf8')

  for (const theme of ALL_THEMES) {
    it(`${theme.id}: text on surface meets WCAG AA`, () => {
      const block = readThemeBlock(css, theme.id)
      const text = readVar(block, '--text')
      const surface = readVar(block, '--surface')
      expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('semantic success and danger stay distinct from salvia/terracota primaries', () => {
    const root = css.slice(0, css.indexOf('[data-theme='))
    const success = readVar(root.includes('--success:') ? css : css, '--success')
    // Read from :root semantic block at top after first :root spacing block — use fixed brand values.
    expect(success === '#1f7a4d' || css.includes('--success: #1f7a4d')).toBe(true)
    expect(css.includes('--danger: #c0392b')).toBe(true)
    const salvia = readThemeBlock(css, 'salvia')
    const terracota = readThemeBlock(css, 'terracota')
    expect(readVar(salvia, '--primary')).not.toBe('#1f7a4d')
    expect(readVar(terracota, '--primary')).not.toBe('#c0392b')
  })
})

describe('no raw hex outside tokens for app chrome', () => {
  it('page.module.css prefers CSS variables for colors', () => {
    const pageCss = readFileSync(resolve(__dirname, '../pages/page.module.css'), 'utf8')
    const hexHits = pageCss.match(/#[0-9a-fA-F]{3,8}/g) ?? []
    expect(hexHits.length).toBeLessThanOrEqual(4)
  })
})
