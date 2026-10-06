import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from '../pages/page.module.css'

type Props = {
  title: string
  kicker?: string
  actions?: ReactNode
  /** Shows a "back to Relatórios" link for secondary pages. */
  secondary?: boolean
}

export function PageHeader({ title, kicker, actions, secondary = false }: Props) {
  return (
    <div className={styles.header}>
      <div>
        {secondary ? (
          <Link to="/relatorios" className={styles.kicker}>
            ← Relatórios
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
