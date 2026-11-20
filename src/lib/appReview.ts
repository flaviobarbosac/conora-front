import { AppReview } from '@capawesome/capacitor-app-review'
import { isNativeApp } from './platform'

const STORAGE_KEY = 'conora.appReview.lastRequestAt'
/** Ask at most once every 4 months per device (the stores add their own quotas on top). */
export const APP_REVIEW_INTERVAL_MS = 120 * 24 * 60 * 60 * 1000
/** Small pause so the review sheet does not cover the celebration the user is looking at. */
export const APP_REVIEW_DELAY_MS = 1500

function readLastRequest(storage: Storage): number | null {
  try {
    const value = Number(storage.getItem(STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** True when this device has not been asked for a review in the last interval. */
export function shouldRequestAppReview(now: number, storage: Storage = localStorage): boolean {
  const last = readLastRequest(storage)
  return last === null || now - last >= APP_REVIEW_INTERVAL_MS
}

/**
 * Asks the Play Store / App Store to show its native review sheet. Call it only right after a
 * positive moment (month closed, subscription confirmed).
 * No-op on the web and when the device was asked recently. The store decides whether the sheet
 * actually appears and never tells the app if the user rated, so failures are silent.
 */
export function requestAppReview(
  deps: { now?: () => number; storage?: Storage; native?: () => boolean; request?: () => Promise<void> } = {},
): void {
  const native = deps.native ?? isNativeApp
  if (!native()) return
  const storage = deps.storage ?? globalThis.localStorage
  const now = (deps.now ?? Date.now)()
  if (!shouldRequestAppReview(now, storage)) return
  try {
    storage.setItem(STORAGE_KEY, String(now))
  } catch {
    // Storage unavailable: still ask once; the store quota keeps it from repeating too often.
  }
  const request = deps.request ?? (() => AppReview.requestReview())
  setTimeout(() => {
    request().catch(() => {
      // Store unavailable (e.g. sideloaded build or iOS < 14): nothing to show.
    })
  }, APP_REVIEW_DELAY_MS)
}
