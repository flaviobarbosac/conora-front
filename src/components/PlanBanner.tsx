import { Link, useLocation } from 'react-router-dom'
import { usePlanAccess } from '../hooks/usePlanAccess'
import { hasFullAccess, isFreeLimited } from '../lib/freeTier'
import styles from './PlanBanner.module.css'

/** Thin banner above every page that nudges toward the plans screen near/after the trial end. */
export function PlanBanner() {
  const { plan } = usePlanAccess()
  const { pathname } = useLocation()
  // Pages that already show a free-tier line — skip the global banner there.
  if (
    !plan ||
    pathname === '/plano' ||
    pathname === '/categorias' ||
    pathname.startsWith('/categorias/') ||
    pathname === '/marcos' ||
    pathname === '/membros'
  ) {
    return null
  }

  let tone: 'info' | 'warning' = 'info'
  let lines: string[]
  let cta: string

  if (isFreeLimited(plan) && !hasFullAccess(plan)) {
    tone = 'warning'
    if (plan.everSubscribed) {
      lines = [
        'Seu plano venceu. Você continua no Conora grátis, com aluguel, luz, água e escola. Renove para voltar ao acesso completo.',
      ]
      cta = 'Renovar plano'
    } else {
      lines = ['Você está no plano gratuito.', 'Assine e libere o Conora completo.']
      cta = 'Assinar plano'
    }
  } else {
    return null
  }

  return (
    <div className={`${styles.banner} ${styles[tone]}`} role="status">
      <span className={styles.copy}>
        {lines.map((line) => (
          <span key={line} className={styles.line}>
            {line}
          </span>
        ))}
      </span>
      {cta ? (
        <Link to="/plano" className={styles.cta}>
          {cta}
        </Link>
      ) : null}
    </div>
  )
}
