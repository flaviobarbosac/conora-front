import { Capacitor } from '@capacitor/core'
import { pushApi, type PushPlatform } from '../api/finance/pushApi'
import { getAccessToken } from '../api/client'
import { isNativeApp } from './platform'

const TOKEN_KEY = 'conora.pushToken'

type PushPlugin = typeof import('@capacitor/push-notifications').PushNotifications

let started = false
let registrationHandle: { remove: () => Promise<void> } | null = null
let errorHandle: { remove: () => Promise<void> } | null = null

function platformForApi(): PushPlatform {
  const platform = Capacitor.getPlatform()
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'web'
}

async function loadPlugin(): Promise<PushPlugin | null> {
  if (!isNativeApp()) return null
  const mod = await import('@capacitor/push-notifications')
  return mod.PushNotifications
}

/** Asks for notification permission, then registers for FCM/APNs and POSTs the token. */
export async function ensurePushRegistration(): Promise<'registered' | 'denied' | 'skipped' | 'failed'> {
  if (!isNativeApp() || !getAccessToken()) {
    return 'skipped'
  }

  try {
    const PushNotifications = await loadPlugin()
    if (!PushNotifications) return 'skipped'

    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions()
    }

    if (permission.receive !== 'granted') {
      return 'denied'
    }

    await attachListeners(PushNotifications)
    await PushNotifications.register()
    return 'registered'
  } catch {
    return 'failed'
  }
}

async function attachListeners(PushNotifications: PushPlugin): Promise<void> {
  if (started) return
  started = true

  registrationHandle = await PushNotifications.addListener('registration', (event) => {
    void persistToken(event.value)
  })

  errorHandle = await PushNotifications.addListener('registrationError', () => {
    // Permission was granted but APNs/FCM registration failed — keep the app usable.
  })
}

async function persistToken(token: string): Promise<void> {
  const trimmed = token.trim()
  if (trimmed.length < 20 || !getAccessToken()) return

  try {
    await pushApi.registerToken(trimmed, platformForApi())
    localStorage.setItem(TOKEN_KEY, trimmed)
  } catch {
    // Network / auth errors must not break the session.
  }
}

/** Soft-unregister on logout when we still have a stored token. */
export async function clearPushRegistration(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && getAccessToken()) {
    try {
      await pushApi.unregisterToken(token)
    } catch {
      // ignore
    }
  }
  localStorage.removeItem(TOKEN_KEY)

  if (registrationHandle) {
    await registrationHandle.remove().catch(() => undefined)
    registrationHandle = null
  }
  if (errorHandle) {
    await errorHandle.remove().catch(() => undefined)
    errorHandle = null
  }
  started = false
}
