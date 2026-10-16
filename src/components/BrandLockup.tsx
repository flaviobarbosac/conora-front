import { useEffect, useState } from 'react'
import { isDarkTheme } from '../theme/themes'
import { useTheme } from '../theme/ThemeProvider'
import styles from './BrandLockup.module.css'

type Props = {
  size?: 'nav' | 'auth'
  /** Rail/collapsed sidebar: only the symbol. */
  compact?: boolean
  /** Show “uma solução Onra”. Default: only on auth screens. */
  showOnra?: boolean
}

/** App chrome uses the O symbol; auth may show wordmark + Onra signature. */
export function BrandLockup({ size = 'nav', compact = false, showOnra = size === 'auth' }: Props) {
  const { theme } = useTheme()
  const suffix = isDarkTheme(theme) ? 'escuro' : 'claro'
  const conoraLogo = `${import.meta.env.BASE_URL}brand/conora-${suffix}.png`
  const onraLogo = `${import.meta.env.BASE_URL}brand/logo-${suffix}.png`
  const symbol = `${import.meta.env.BASE_URL}brand/simbolo.png`
  const [logoReady, setLogoReady] = useState(false)

  useEffect(() => {
    if (size !== 'auth' || compact) {
      return
    }
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
  }, [conoraLogo, compact, size])

  if (compact || size === 'nav') {
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
      {showOnra ? (
        <span className={styles.signature}>
          uma solução <img src={onraLogo} alt="Onra" />
        </span>
      ) : null}
    </div>
  )
}
