import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guestAuthPath, hasKnownAccount, markKnownAccount } from './deviceIdentity'

function installMemoryStorage(): void {
  const store = new Map<string, string>()
  const memory: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true })
}

describe('deviceIdentity', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('treats empty storage as first access (register)', () => {
    expect(hasKnownAccount()).toBe(false)
    expect(guestAuthPath()).toBe('/register')
  })

  it('after markKnownAccount opens login', () => {
    markKnownAccount()
    expect(hasKnownAccount()).toBe(true)
    expect(guestAuthPath()).toBe('/login')
  })

  it('honours legacy seenHome as returning device', () => {
    localStorage.setItem('conora.seenHome', '1')
    expect(guestAuthPath()).toBe('/login')
  })
})
