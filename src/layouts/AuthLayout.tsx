import type { ReactNode } from 'react'
import { BrandLockup } from '../components/BrandLockup'
import { useTheme } from '../theme/ThemeProvider'
import styles from './AuthLayout.module.css'

type Props = {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  const { theme } = useTheme()
  const illustration = theme === 'dark' ? '/brand/ilustracao-escura.jpg' : '/brand/ilustracao-login.jpg'

  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <img src={illustration} alt="" />
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Conora</span>
          <span className={styles.headline}>Seu dinheiro organizado pelo método que você aprendeu.</span>
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
      </div>
    </div>
  )
}
