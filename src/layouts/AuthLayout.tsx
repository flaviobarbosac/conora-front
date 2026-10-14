import type { ReactNode } from 'react'
import { BrandLockup } from '../components/BrandLockup'
import { isDarkTheme } from '../theme/themes'
import { useTheme } from '../theme/ThemeProvider'
import styles from './AuthLayout.module.css'

type Props = {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
  heroHeadline?: string
}

export function AuthLayout({ title, subtitle, children, footer, heroHeadline }: Props) {
  const { theme } = useTheme()
  const illustration = `${import.meta.env.BASE_URL}brand/${isDarkTheme(theme) ? 'ilustracao-escura' : 'ilustracao-login'}.jpg`

  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <img src={illustration} alt="" />
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Conora</span>
          <span className={styles.headline}>
            {heroHeadline ?? 'Organize o dinheiro da família com clareza — mês a mês.'}
          </span>
        </div>
      </div>
      <div className={styles.panel}>
        <BrandLockup size="auth" />
        <div className={styles.intro}>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
        {footer ? <p className={styles.footer}>{footer}</p> : null}
        <p className={styles.legal}>
          <a href="https://conora.com.br/privacidade" target="_blank" rel="noreferrer">
            Privacidade
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://conora.com.br/termos" target="_blank" rel="noreferrer">
            Termos
          </a>
        </p>
      </div>
    </div>
  )
}
