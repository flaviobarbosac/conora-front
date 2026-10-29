import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}))

import { Capacitor } from '@capacitor/core'
import { getAppPlatform, isAndroidApp, isIosApp, isNativeApp } from './platform'

describe('platform', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web')
  })

  it('defaults to web', () => {
    expect(isNativeApp()).toBe(false)
    expect(isIosApp()).toBe(false)
    expect(isAndroidApp()).toBe(false)
    expect(getAppPlatform()).toBe('Web')
  })

  it('detects ios and android', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios')
    expect(isIosApp()).toBe(true)
    expect(getAppPlatform()).toBe('iOS')
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    expect(isAndroidApp()).toBe(true)
    expect(getAppPlatform()).toBe('Android')
  })
})
