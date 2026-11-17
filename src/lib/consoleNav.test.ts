import { describe, expect, it } from 'vitest'
import { CONSOLE_NAV } from './consoleNav'

describe('CONSOLE_NAV', () => {
  it('lists console areas with unique ids and routes', () => {
    expect(CONSOLE_NAV).toHaveLength(9)
    const ids = CONSOLE_NAV.map((item) => item.id)
    expect(new Set(ids).size).toBe(9)
    expect(ids).toContain('jornada-tipos')
    expect(ids).toContain('acesso')
    expect(ids).toContain('clientes')
    expect(CONSOLE_NAV.find((item) => item.id === 'acesso')?.to).toBe('/console/acesso')
    expect(CONSOLE_NAV.find((item) => item.id === 'clientes')?.to).toBe('/console/clientes')
    for (const item of CONSOLE_NAV) {
      expect(item.to.startsWith('/console/')).toBe(true)
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.purpose.length).toBeGreaterThan(0)
    }
  })
})
