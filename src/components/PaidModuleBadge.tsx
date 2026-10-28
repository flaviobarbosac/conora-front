import { Link } from 'react-router-dom'
import { PAID_MODULE_BADGE } from '../lib/freeTier'
import styles from '../pages/page.module.css'

/** Commercial tag on free-tier modules that stay read-only until a paid plan. */
export function PaidModuleBadge() {
  return (
    <Link to="/plano" className={`${styles.badge} ${styles.badge_info}`} title={PAID_MODULE_BADGE}>
      {PAID_MODULE_BADGE}
    </Link>
  )
}
