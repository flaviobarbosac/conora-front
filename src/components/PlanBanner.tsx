import { Link, useLocation } from 'react-router-dom'
import { formatDate } from '../lib/format'
import { isAndroidApp } from '../lib/platform'
import { usePlanAccess } from '../hooks/usePlanAccess'
import styles from './PlanBanner.module.css'

/** Days before the trial ends when the countdown banner starts showing. */
const TRIAL_WARNING_DAYS = 15

/** Thin banner above every page that nudges toward the plans screen near/after the trial end. */
export function PlanBanner() {
  const { plan } = usePlanAccess()
  const { pathname } = useLocation()
  const hideCheckout = isAndroidApp()
  if (!plan || pathname === '/plano') {
    return null
  }

  let tone: 'info' | 'warning' = 'info'
  let text: string
  let cta: string | null
  if (plan.phase === 'Trial' && plan.daysLeft <= TRIAL_WARNING_DAYS) {
    text =
      plan.daysLeft <= 1
        ? hideCheckout
          ? 'Seu acesso gratuito termina hoje.'
          : 'Seu acesso gratuito termina hoje. Assine para continuar lançando sem interrupção.'
        : hideCheckout
          ? `Seu acesso gratuito termina em ${plan.daysLeft} dias.`
          : `Seu acesso gratuito termina em ${plan.daysLeft} dias. Escolha seu plano e continue sem interrupção.`
    cta = hideCheckout ? null : 'Ver planos'
  } else if (plan.phase === 'Grace') {
    tone = 'warning'
    text = `Modo somente leitura: você pode consultar e exportar seus dados até ${formatDate(plan.blockAt)}.`
    cta = hideCheckout ? null : 'Assinar agora'
  } else if (plan.phase === 'Expired') {
    tone = 'warning'
    text = 'Seu plano venceu e o Conora está em modo somente leitura.'
    cta = hideCheckout ? null : 'Renovar plano'
  } else {
    return null
  }

  return (
    <div className={`${styles.banner} ${styles[tone]}`} role="status">
      <span>{text}</span>
      {cta ? (
        <Link to="/plano" className={styles.cta}>
          {cta}
        </Link>
      ) : null}
    </div>
  )
}
