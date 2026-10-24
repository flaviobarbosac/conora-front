import type { Product } from '@capgo/native-purchases'
import { planApi, type PlanOffer } from '../api/finance'
import { confirmDestructive } from './confirm'
import { formatMoney } from './format'
import { TIER_INFO } from './planAccess'
import {
  buyInStore,
  isStoreCancel,
  STORE_PRODUCT_IDS,
  storeCheckoutAvailable,
} from './storeBilling'

/** Store purchase, or the local dev stub. Null when the user closes the sheet. */
export async function purchasePlan(
  offer: PlanOffer,
  products: Record<string, Product>,
): Promise<string | null> {
  const info = TIER_INFO[offer.tier]
  if (storeCheckoutAvailable()) {
    const productId = STORE_PRODUCT_IDS[offer.kind]
    try {
      await buyInStore(offer.kind, productId ? products[productId] : undefined)
    } catch (error) {
      if (isStoreCancel(error)) return null
      throw error
    }
    return `Plano ${info.title} ativado. Obrigado por assinar o Conora!`
  }

  const cycle = offer.yearly ? 'ano' : 'mês'
  const ok = await confirmDestructive(
    `Assinar o plano ${info.title} ${offer.yearly ? 'anual' : 'mensal'} por ${formatMoney(offer.price)}/${cycle}?`,
    { title: 'Confirmar assinatura', confirmLabel: 'Assinar', danger: false },
  )
  if (!ok) return null
  await planApi.subscribe(offer.kind, `dev-store-${offer.kind}-${Date.now()}`)
  return `Plano ${info.title} ativado (loja simulada em desenvolvimento).`
}
