import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from '../pages/pageStyles'

type BackLink = {
  to: string
  label: string
}

type Props = {
  title: string
  kicker?: string
  actions?: ReactNode
  /**
   * Secondary page chrome: back link. Prefer explicit `backTo`.
   * Legacy `secondary` alone no longer hardcodes Relatórios.
   */
  secondary?: boolean
  backTo?: BackLink
}

export function PageHeader({ title, kicker, actions, secondary = false, backTo }: Props) {
  const link =
    backTo ??
    (secondary
      ? { to: '/relatorios', label: '← Relatórios' }
      : null)

  return (
    <div className={styles.header}>
      <div>
        {link ? (
          <Link to={link.to} className={styles.kicker}>
            {link.label}
          </Link>
        ) : kicker ? (
          <div className={styles.kicker}>{kicker}</div>
        ) : null}
        <h1>{title}</h1>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  )
}
