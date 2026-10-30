import { describe, expect, it } from 'vitest'
import { formatClickCrumb } from './categoryCrumb'

const path = ['Orçamento', 'Despesas', 'Despesas acessórias']

describe('formatClickCrumb', () => {
  it('shows the click path with slashes', () => {
    const fits = () => true
    expect(formatClickCrumb(['Orçamento'], fits)).toBe('Orçamento')
    expect(formatClickCrumb(['Orçamento', 'Despesas'], fits)).toBe('Orçamento / Despesas')
    expect(formatClickCrumb(path, fits)).toBe('Orçamento / Despesas / Despesas acessórias')
  })

  it('cuts from the start and keeps the last clicked item', () => {
    const fits = (text: string) => text.startsWith('...')
    expect(formatClickCrumb(path, fits)).toBe('... / Despesas / Despesas acessórias')
  })

  it('drops earlier items until the last one fits', () => {
    const last = '... / Despesas acessórias'
    const fits = (text: string) => text === last || text === 'Despesas acessórias'
    expect(formatClickCrumb(path, fits)).toBe(last)
  })

  it('ellipsis the last name from the start when it alone overflows', () => {
    const fits = (text: string) => text.length <= 12
    const label = formatClickCrumb(['Despesas acessórias'], fits)
    expect(label.startsWith('...')).toBe(true)
    expect(label.endsWith('órias')).toBe(true)
    expect(label.length).toBeLessThanOrEqual(12)
  })
})