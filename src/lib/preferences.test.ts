import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PREFERENCES_CHANGED,
  readHomeJourneyTimeline,
  readSidebarCollapsed,
  writeHomeJourneyTimeline,
  writeSidebarCollapsed,
} from './preferences'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  const listeners = new Map<string, Set<EventListener>>()
  vi.stubGlobal('localStorage', {
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

describe('preferences', () => {
  it('sidebar collapsed defaults false and writes', () => {
    expect(readSidebarCollapsed()).toBe(false)
    const spy = vi.fn()
    window.addEventListener(PREFERENCES_CHANGED, spy)
    writeSidebarCollapsed(true)
    expect(readSidebarCollapsed()).toBe(true)
    expect(spy).toHaveBeenCalled()
  })

  it('home journey timeline defaults true when absent', () => {
    expect(readHomeJourneyTimeline()).toBe(true)
    writeHomeJourneyTimeline(false)
    expect(readHomeJourneyTimeline()).toBe(false)
    writeHomeJourneyTimeline(true)
    expect(readHomeJourneyTimeline()).toBe(true)
  })
})
