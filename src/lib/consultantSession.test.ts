import { afterEach, describe, expect, it } from 'vitest'
import { clearSharedMonth, enterSharedMonth, readSharedClient, sharedCompetence } from './consultantSession'

const memory = new Map<string, string>()

afterEach(() => {
  memory.clear()
})

globalThis.sessionStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value)
  },
  removeItem: (key: string) => {
    memory.delete(key)
  },
  clear: () => memory.clear(),
  key: () => null,
  get length() {
    return memory.size
  },
}

describe('consultant shared month', () => {
  it('enters the client month and leaves only when the session is cleared', () => {
    expect(readSharedClient()).toBeNull()
    enterSharedMonth('client-1', '2026-08')
    expect(sharedCompetence()).toBe('2026-08')
    expect(readSharedClient()).toEqual({ clientId: 'client-1', competenceYm: '2026-08' })
    clearSharedMonth()
    expect(readSharedClient()).toBeNull()
  })

  it('ignores a month that is not a competence', () => {
    enterSharedMonth('client-1', 'agosto')
    expect(sharedCompetence()).toBeNull()
    expect(readSharedClient()).toBeNull()
  })
})
