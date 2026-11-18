import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkPermissions = vi.fn()
const requestPermissions = vi.fn()
const register = vi.fn()
const addListener = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}))

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions,
    requestPermissions,
    register,
    addListener,
  },
}))

vi.mock('../api/client', () => ({
  getAccessToken: vi.fn(() => 'access-token'),
}))

vi.mock('../api/finance/pushApi', () => ({
  pushApi: {
    registerToken: vi.fn(async () => ({
      id: '1',
      token: 'abcdefghijklmnopqrstuvwxyz',
      platform: 'android',
      lastSeenAt: new Date().toISOString(),
    })),
    unregisterToken: vi.fn(async () => undefined),
  },
}))

vi.mock('./platform', () => ({
  isNativeApp: vi.fn(() => true),
}))

describe('pushNotifications', () => {
  beforeEach(() => {
    vi.resetModules()
    checkPermissions.mockReset()
    requestPermissions.mockReset()
    register.mockReset()
    addListener.mockReset()
    addListener.mockResolvedValue({ remove: vi.fn(async () => undefined) })
  })

  it('does not register token when permission is denied', async () => {
    checkPermissions.mockResolvedValue({ receive: 'denied' })
    const { ensurePushRegistration } = await import('./pushNotifications')
    const { pushApi } = await import('../api/finance/pushApi')

    await expect(ensurePushRegistration()).resolves.toBe('denied')
    expect(register).not.toHaveBeenCalled()
    expect(pushApi.registerToken).not.toHaveBeenCalled()
  })

  it('requests permission then registers when granted', async () => {
    checkPermissions.mockResolvedValue({ receive: 'prompt' })
    requestPermissions.mockResolvedValue({ receive: 'granted' })
    register.mockResolvedValue(undefined)

    const { ensurePushRegistration } = await import('./pushNotifications')
    await expect(ensurePushRegistration()).resolves.toBe('registered')
    expect(requestPermissions).toHaveBeenCalled()
    expect(register).toHaveBeenCalled()
  })
})
