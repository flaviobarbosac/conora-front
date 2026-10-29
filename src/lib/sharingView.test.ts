import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readSharingView, writeSharingView } from './sharingView'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  const listeners = new Map<string, Set<EventListener>>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  })
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: EventListener) => {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    },
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event)
      }
      return true
    },
  })
})

describe('sharingView', () => {
  it('defaults to Family and persists Personal', () => {
    expect(readSharingView()).toBe('Family')
    const spy = vi.fn()
    window.addEventListener('conora:sharing-view', spy)
    writeSharingView('Personal')
    expect(readSharingView()).toBe('Personal')
    expect(spy).toHaveBeenCalled()
  })
})
