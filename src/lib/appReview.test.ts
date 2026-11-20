import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capawesome/capacitor-app-review', () => ({ AppReview: { requestReview: vi.fn() } }))

import { APP_REVIEW_DELAY_MS, APP_REVIEW_INTERVAL_MS, requestAppReview, shouldRequestAppReview } from './appReview'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

const KEY = 'conora.appReview.lastRequestAt'
const NOW = 1_800_000_000_000

describe('shouldRequestAppReview', () => {
  it('asks when the device was never asked', () => {
    expect(shouldRequestAppReview(NOW, memoryStorage())).toBe(true)
  })

  it('waits for the interval after the last request', () => {
    const storage = memoryStorage({ [KEY]: String(NOW - APP_REVIEW_INTERVAL_MS + 1) })
    expect(shouldRequestAppReview(NOW, storage)).toBe(false)
    expect(shouldRequestAppReview(NOW + 1, storage)).toBe(true)
  })

  it('treats a corrupt value as never asked', () => {
    expect(shouldRequestAppReview(NOW, memoryStorage({ [KEY]: 'abc' }))).toBe(true)
  })
})

describe('requestAppReview', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does nothing on the web', () => {
    const request = vi.fn(() => Promise.resolve())
    const storage = memoryStorage()
    requestAppReview({ native: () => false, request, storage, now: () => NOW })
    vi.runAllTimers()
    expect(request).not.toHaveBeenCalled()
    expect(storage.getItem(KEY)).toBeNull()
  })

  it('asks after a short delay and records the time', () => {
    const request = vi.fn(() => Promise.resolve())
    const storage = memoryStorage()
    requestAppReview({ native: () => true, request, storage, now: () => NOW })
    expect(storage.getItem(KEY)).toBe(String(NOW))
    vi.advanceTimersByTime(APP_REVIEW_DELAY_MS - 1)
    expect(request).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not ask twice within the interval', () => {
    const request = vi.fn(() => Promise.resolve())
    const storage = memoryStorage()
    requestAppReview({ native: () => true, request, storage, now: () => NOW })
    requestAppReview({ native: () => true, request, storage, now: () => NOW + 1000 })
    vi.runAllTimers()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('swallows store errors', async () => {
    const request = vi.fn(() => Promise.reject(new Error('no store')))
    requestAppReview({ native: () => true, request, storage: memoryStorage(), now: () => NOW })
    vi.runAllTimers()
    await Promise.resolve()
    expect(request).toHaveBeenCalledTimes(1)
  })
})
