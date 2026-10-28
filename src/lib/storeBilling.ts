import { NativePurchases, PURCHASE_TYPE, type Product } from '@capgo/native-purchases'
import { getAccessToken, userIdFromAccessToken } from '../api/client'
import { planApi, type Plan, type PlanKind, type StorePurchase } from '../api/finance'
import { isAndroidApp, isIosApp } from './platform'
import { googleBasePlanId, STORE_MANAGE_URL, STORE_PRODUCT_IDS } from './storeProducts'

export { STORE_PRODUCT_IDS } from './storeProducts'

/** Native app with a store that sells Conora plans (App Store or Google Play). */
export function storeCheckoutAvailable(): boolean {
  return isIosApp() || isAndroidApp()
}

export function storeName(): string {
  return isIosApp() ? 'App Store' : 'Google Play'
}

function channel(): StorePurchase['channel'] {
  return isIosApp() ? 2 : 1
}

function accountToken(): string {
  const id = userIdFromAccessToken(getAccessToken())
  if (!id) throw new Error('Entre de novo na sua conta para assinar.')
  return id
}

function productIdOf(product: Product): string {
  // Android subscriptions: identifier is the base plan, planIdentifier is the product id.
  return isAndroidApp() ? (product.planIdentifier ?? product.identifier) : product.identifier
}

/** True when the user closed the store sheet (not an error to show). */
export function isStoreCancel(error: unknown): boolean {
  const text = String((error as { message?: string; code?: string })?.message ?? error ?? '').toLowerCase()
  const code = String((error as { code?: string })?.code ?? '').toLowerCase()
  return code.includes('cancel') || text.includes('cancel')
}

/**
 * Prefer the App Store / Play localized string only when it is clearly BRL (or unlabeled).
 * Price points must be set in App Store Connect for Brazil; a bare US$ string must not look
 * like another Conora offer next to the BRL catalog table.
 */
export function storePriceLabel(product: Product | undefined, catalogPrice: number, formatCatalog: (n: number) => string): string {
  if (!product?.priceString) return formatCatalog(catalogPrice)
  const raw = product.priceString.trim()
  const currency = String((product as { currencyCode?: string }).currencyCode ?? '').toUpperCase()
  if (currency && currency !== 'BRL') return formatCatalog(catalogPrice)
  if (/(US\$|USD|\$)\s*\d/i.test(raw) && !/R\$|BRL/i.test(raw)) return formatCatalog(catalogPrice)
  return raw
}

/** Localized store prices by Conora product id (empty when the store is unreachable). */
export async function storeProducts(): Promise<Record<string, Product>> {
  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: Object.values(STORE_PRODUCT_IDS) as string[],
      productType: PURCHASE_TYPE.SUBS,
    })
    const map: Record<string, Product> = {}
    for (const product of products) {
      const id = productIdOf(product)
      if (isAndroidApp() && product.identifier !== googleBasePlanId(id)) continue
      if (!map[id] || !product.offerId) map[id] = product
    }
    return map
  } catch {
    return {}
  }
}

/** Opens the native purchase sheet, then has the API validate the purchase with the store. */
export async function buyInStore(kind: PlanKind, product?: Product): Promise<Plan> {
  const productId = STORE_PRODUCT_IDS[kind]
  if (!productId) throw new Error('Plano indisponível na loja.')
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    planIdentifier: isAndroidApp() ? googleBasePlanId(productId) : undefined,
    offerToken: isAndroidApp() ? product?.offerToken : undefined,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: accountToken(),
  })
  return planApi.confirmStore({
    channel: channel(),
    productId,
    transactionId: transaction.transactionId || transaction.purchaseToken || '',
    purchaseToken: transaction.purchaseToken,
  })
}

/** "Restaurar compras": re-sends this login's active store subscriptions to the API. */
export async function restoreStorePurchases(): Promise<Plan | null> {
  try {
    await NativePurchases.restorePurchases()
  } catch (error) {
    // App Store sync often fails on TestFlight ("Unable to Complete Request"); the device still
    // holds the current entitlements, so read them anyway. Closing the sign-in prompt is a cancel.
    if (isStoreCancel(error)) throw error
  }
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: accountToken(),
    onlyCurrentEntitlements: true,
  })
  const ours = new Set(Object.values(STORE_PRODUCT_IDS))
  let plan: Plan | null = null
  for (const purchase of purchases) {
    if (!ours.has(purchase.productIdentifier)) continue
    plan = await planApi.confirmStore({
      channel: channel(),
      productId: purchase.productIdentifier,
      transactionId: purchase.transactionId || purchase.purchaseToken || '',
      purchaseToken: purchase.purchaseToken,
    })
  }
  return plan
}

export async function openStoreSubscriptions(): Promise<void> {
  try {
    await NativePurchases.manageSubscriptions()
  } catch {
    window.open(isIosApp() ? STORE_MANAGE_URL.ios : STORE_MANAGE_URL.android, '_blank', 'noopener')
  }
}
