import { useEffect, useState } from 'react'
import { useTheme } from '../theme/ThemeProvider'
import styles from './BrandLockup.module.css'

type Props = {
  size?: 'nav' | 'auth'
  /** Rail/collapsed sidebar: only the Conora symbol, no wordmark. */
  compact?: boolean
}

/** Prefers the Conora logo image (public/brand/conora-claro|escuro.png) and falls back to the wordmark. */
export function BrandLockup({ size = 'nav', compact = false }: Props) {
  const { theme } = useTheme()
  const suffix = theme === 'dark' ? 'escuro' : 'claro'
  const conoraLogo = `${import.meta.env.BASE_URL}brand/conora-${suffix}.png`
  const onraLogo = `${import.meta.env.BASE_URL}brand/logo-${suffix}.png`
  const symbol = `${import.meta.env.BASE_URL}brand/simbolo.png`
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const probe = new Image()
    probe.onload = () => {
      if (!cancelled) {
        setLogoReady(true)
      }
    }
    probe.onerror = () => {
      if (!cancelled) {
        setLogoReady(false)
      }
    }
    probe.src = conoraLogo
    return () => {
      cancelled = true
    }
  }, [conoraLogo])

  if (compact) {
    return (
      <div className={`${styles.lockup} ${styles[size]} ${styles.compact}`}>
        <img className={styles.mark} src={symbol} alt="Conora" />
      </div>
    )
  }

  return (
    <div className={`${styles.lockup} ${styles[size]}`}>
      {logoReady ? (
        <img className={styles.logo} src={conoraLogo} alt="Conora" />
      ) : (
        <span className={styles.conora}>Conora</span>
      )}
      <span className={styles.signature}>
        uma solução <img src={onraLogo} alt="Onra" />
      </span>
    </div>
  )
}
