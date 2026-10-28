import { Capacitor } from '@capacitor/core'

export type AppPlatform = 'Web' | 'iOS' | 'Android'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function isIosApp(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

export function isAndroidApp(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/** Platform label stored with user feedback (Web / iOS / Android). */
export function getAppPlatform(): AppPlatform {
  if (isIosApp()) return 'iOS'
  if (isAndroidApp()) return 'Android'
  return 'Web'
}
