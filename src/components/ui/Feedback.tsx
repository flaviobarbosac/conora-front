import type { ReactNode } from 'react'
import type { Tone } from '../../lib/severity'
import styles from '../../pages/page.module.css'

export function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <p className={styles.error} role="alert">
      {message}
    </p>
  ) : null
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p className={styles.muted} aria-live="polite">
      {label}
    </p>
  )
}

export function Skeleton({ height = 80 }: { height?: number }) {
  return <div className={styles.skeleton} style={{ minHeight: height }} aria-hidden="true" />
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>
}

export function Badge({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>
}
