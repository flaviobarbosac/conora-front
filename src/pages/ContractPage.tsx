import { useEffect, useState } from 'react'
import type { Product } from '@capgo/native-purchases'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { familyApi, planApi, type PlanKind, type PlanOffer } from '../api/finance'
import { LegalConsentPanel } from '../components/LegalConsentPanel'
import { Button } from '../components/ui/Button'
import { ErrorText, Loading } from '../components/ui/Feedback'
import { useAction } from '../hooks/useAction'
import { useLoad } from '../hooks/useLoad'
import { PLAN_CHANGED, TIER_INFO } from '../lib/planAccess'
import { purchasePlan } from '../lib/planCheckout'
import { showSaveToast } from '../lib/saveToast'
import { storeCheckoutAvailable, storeProducts } from '../lib/storeBilling'
import styles from './PlanPage.module.css'

const KINDS: ReadonlyArray<PlanKind> = [
  'IndividualMonthly',
  'IndividualYearly',
  'FamilyMonthly',
  'FamilyYearly',
  'FamilyPlusMonthly',
  'FamilyPlusYearly',
]

function isPlanKind(value: string | null): value is PlanKind {
  return !!value && (KINDS as ReadonlyArray<string>).includes(value)
}

export function ContractPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const rawKind = params.get('kind')
  const kind: PlanKind | null = isPlanKind(rawKind) ? rawKind : null
  const profile = useLoad(() => familyApi.profile(), [])
  const plan = useLoad(() => planApi.get(), [])
  const action = useAction()
  const [acceptContract, setAcceptContract] = useState(false)
  const [acceptLgpd, setAcceptLgpd] = useState(false)
  const [products, setProducts] = useState<Record<string, Product>>({})
  const offer: PlanOffer | undefined = kind ? plan.data?.offers.find((item) => item.kind === kind) : undefined
  const acknowledged = Boolean(profile.data?.contractAcknowledgedAt)
  const subscribing = Boolean(kind)

  useEffect(() => {
    if (!storeCheckoutAvailable()) return
    let active = true
    void storeProducts().then((found) => {
      if (active) setProducts(found)
    })
    return () => {
      active = false
    }
  }, [])

  async function confirm() {
    if (!offer) {
      action.setError('Plano indisponível.')
      return
    }
    if (!acknowledged && (!acceptContract || !acceptLgpd)) {
      action.setError('Aceite o contrato, a política de cancelamento e a LGPD antes de assinar.')
      return
    }
    let message: string | null = null
    const ok = await action.run(async () => {
      if (!acknowledged) await familyApi.acknowledgeContract()
      message = await purchasePlan(offer, products)
    })
    if (!ok || !message) return
    showSaveToast(message)
    window.dispatchEvent(new Event(PLAN_CHANGED))
    navigate('/plano', { replace: true, state: { celebrate: true } })
  }

  const title = offer ? TIER_INFO[offer.tier].title : null

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <span className={styles.eyebrow}>Contrato</span>
        <h1>{subscribing ? `Ciente para assinar ${title ?? 'o plano'}` : 'Contrato, cancelamento e LGPD'}</h1>
        <p>
          {subscribing
            ? 'Esta tela aparece só na primeira assinatura. O ciente fica no seu perfil.'
            : 'Você pode ler o contrato quando quiser. O ciente é pedido na primeira vez que você assina.'}
        </p>
      </header>

      <ErrorText message={action.error ?? profile.error ?? plan.error} />
      {(profile.loading && !profile.data) || (subscribing && plan.loading && !plan.data) ? <Loading /> : null}

      <LegalConsentPanel
        acceptContract={acceptContract}
        acceptLgpd={acceptLgpd}
        onAcceptContract={setAcceptContract}
        onAcceptLgpd={setAcceptLgpd}
        showChecks={subscribing && !acknowledged}
      />

      <div className={styles.heroActions}>
        {subscribing ? (
          <Button className={styles.cta} disabled={action.busy || !offer} onClick={() => void confirm()}>
            {acknowledged ? `Assinar ${title ?? 'plano'}` : 'Ciente e assinar'}
          </Button>
        ) : null}
        <Link to="/plano">Voltar aos planos</Link>
      </div>
    </div>
  )
}
