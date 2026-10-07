import { Capacitor } from '@capacitor/core'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function isIosApp(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

export function isAndroidApp(): boolean {
  return Capacitor.getPlatform() === 'android'
}
