import { Link, useLocation } from 'react-router-dom'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { hasFullAccess, isFreeLimited } from '../lib/freeTier'
import styles from './PlanBanner.module.css'

/** Days before the student trial ends when the countdown banner starts showing. */
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

  if (plan.isTrainingStudent && plan.phase === 'Trial' && plan.daysLeft <= TRIAL_WARNING_DAYS) {
    text =
      plan.daysLeft <= 1
        ? 'Seu acesso completo gratuito termina hoje. Assine para continuar com todas as categorias.'
        : `Seu acesso completo gratuito termina em ${plan.daysLeft} dias. Escolha seu plano e continue sem interrupção.`
    cta = 'Ver planos'
  } else if (isFreeLimited(plan) && !hasFullAccess(plan)) {
    tone = 'warning'
    if (plan.everSubscribed) {
      text =
        'Seu plano venceu. Você continua no Conora grátis, com aluguel, luz, água e escola. Renove para voltar ao acesso completo.'
      cta = 'Renovar plano'
    } else {
      text =
        'Você está no plano gratuito. Assine e libere o Conora completo.'
      cta = 'Assinar plano'
    }
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
