import { describe, expect, it } from 'vitest'
import { CONSOLE_NAV } from './consoleNav'

describe('CONSOLE_NAV', () => {
  it('lists six console areas with unique ids and routes', () => {
    expect(CONSOLE_NAV).toHaveLength(6)
    const ids = CONSOLE_NAV.map((item) => item.id)
    expect(new Set(ids).size).toBe(6)
    for (const item of CONSOLE_NAV) {
      expect(item.to.startsWith('/console/')).toBe(true)
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.purpose.length).toBeGreaterThan(0)
    }
  })
})
