import { Link, useLocation } from 'react-router-dom'
import { formatDate } from '../lib/format'
import { usePlanAccess } from '../hooks/usePlanAccess'
import styles from './PlanBanner.module.css'

/** Days before the trial ends when the countdown banner starts showing. */
const TRIAL_WARNING_DAYS = 15

/** Thin banner above every page that nudges toward the plans screen near/after the trial end. */
export function PlanBanner() {
  const { plan } = usePlanAccess()
  const { pathname } = useLocation()
  if (!plan || pathname === '/plano') {
    return null
  }

  let tone: 'info' | 'warning' = 'info'
  let text: string
  let cta: string
  if (plan.phase === 'Trial' && plan.daysLeft <= TRIAL_WARNING_DAYS) {
    text =
      plan.daysLeft <= 1
        ? 'Seu acesso gratuito termina hoje. Assine para continuar lançando sem interrupção.'
        : `Seu acesso gratuito termina em ${plan.daysLeft} dias. Escolha seu plano e continue sem interrupção.`
    cta = 'Ver planos'
  } else if (plan.phase === 'Grace') {
    tone = 'warning'
    text = `Modo somente leitura: você pode consultar e exportar seus dados até ${formatDate(plan.blockAt)}.`
    cta = 'Assinar agora'
  } else if (plan.phase === 'Expired') {
    tone = 'warning'
    text = 'Seu plano venceu e o Conora está em modo somente leitura.'
    cta = 'Renovar plano'
  } else {
    return null
  }

  return (
    <div className={`${styles.banner} ${styles[tone]}`} role="status">
      <span>{text}</span>
      <Link to="/plano" className={styles.cta}>
        {cta}
      </Link>
    </div>
  )
}
