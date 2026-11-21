import { registerPlugin } from '@capacitor/core'
import type { Achievement, PlanOffer } from '../api/finance/types'
import { isNativeApp } from './platform'

/**
 * Meta App Events for the user funnel (native app only; web is a no-op).
 *
 * Event names are stable: Events Manager maps them to SKAdNetwork conversion values.
 * Params carry no personal data (Apple App Privacy declares Product Interaction and
 * Purchase History only).
 *
 * Store purchases are not logged here as fb_mobile_purchase / Subscribe / StartTrial:
 * the Meta SDK auto-logs them (StoreKit 2 on iOS, Play Billing 8+ on Android), so a manual
 * standard event would double count. `subscription_confirmed` is a custom backup logged
 * after the API validates the purchase.
 */
export const META_EVENTS = {
  completeRegistration: 'fb_mobile_complete_registration',
  subscriptionConfirmed: 'subscription_confirmed',
  milestoneAchieved: 'milestone_achieved',
} as const

export type MetaEventName = (typeof META_EVENTS)[keyof typeof META_EVENTS]
export type MetaEventParams = Record<string, string | number>

type ConoraMetaSdkPlugin = {
  logEvent(options: { name: string; params?: MetaEventParams; valueToSum?: number }): Promise<{ logged: boolean }>
}

const ConoraMetaSdk = registerPlugin<ConoraMetaSdkPlugin>('ConoraMetaSdk')

/** Milestones earned longer ago than this are treated as history, not a new conquest. */
export const MILESTONE_FRESH_MS = 7 * 24 * 60 * 60 * 1000

const REGISTERED_KEY = 'conora.meta.registered.'
const MILESTONES_KEY = 'conora.meta.milestones.'

/** Fire-and-forget; never throws and never blocks the UI. */
export function logMetaEvent(name: MetaEventName, params?: MetaEventParams, valueToSum?: number): void {
  if (!isNativeApp()) return
  try {
    void ConoraMetaSdk.logEvent({ name, params, valueToSum }).catch(() => undefined)
  } catch {
    // plugin missing in this build
  }
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable: worst case an event repeats
  }
}

/** Account created (once per account on this device). */
export function logCompleteRegistration(userId: string, method?: 'email' | 'google' | 'apple'): void {
  if (!isNativeApp() || !userId) return
  const key = REGISTERED_KEY + userId
  if (readItem(key)) return
  writeItem(key, '1')
  logMetaEvent(META_EVENTS.completeRegistration, method ? { fb_registration_method: method } : undefined)
}

/** Store purchase confirmed by the API (custom backup; see note at the top). */
export function logSubscriptionConfirmed(offer: Pick<PlanOffer, 'kind' | 'tier' | 'yearly' | 'price'>): void {
  logMetaEvent(
    META_EVENTS.subscriptionConfirmed,
    {
      plan: offer.kind,
      tier: offer.tier,
      cycle: offer.yearly ? 'yearly' : 'monthly',
      fb_currency: 'BRL',
    },
    offer.price,
  )
}

/**
 * Milestone keys that are newly earned: not seen on this device yet and earned recently.
 * Pure helper (exported for tests).
 */
export function newlyEarnedMilestones(
  items: ReadonlyArray<Pick<Achievement, 'key' | 'earned' | 'earnedAt'>>,
  seen: ReadonlySet<string>,
  now: number,
): { fresh: string[]; seenNext: string[] } {
  const next = new Set(seen)
  const fresh: string[] = []
  for (const item of items) {
    if (!item.earned || next.has(item.key)) continue
    next.add(item.key)
    const at = item.earnedAt ? Date.parse(item.earnedAt) : Number.NaN
    if (Number.isFinite(at) && now - at <= MILESTONE_FRESH_MS) fresh.push(item.key)
  }
  return { fresh, seenNext: [...next] }
}

/** One `milestone_achieved` per journey milestone conquered (per account on this device). */
export function logNewMilestones(
  userId: string,
  items: ReadonlyArray<Pick<Achievement, 'key' | 'earned' | 'earnedAt'>>,
): void {
  if (!isNativeApp() || !userId) return
  const key = MILESTONES_KEY + userId
  let seen: string[] = []
  try {
    const parsed: unknown = JSON.parse(readItem(key) ?? '[]')
    if (Array.isArray(parsed)) seen = parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    seen = []
  }
  const { fresh, seenNext } = newlyEarnedMilestones(items, new Set(seen), Date.now())
  if (seenNext.length !== seen.length) writeItem(key, JSON.stringify(seenNext))
  for (const milestoneId of fresh) {
    logMetaEvent(META_EVENTS.milestoneAchieved, { milestone_id: milestoneId })
  }
}
