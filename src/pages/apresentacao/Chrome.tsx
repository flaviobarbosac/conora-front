import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLockup } from '../../components/BrandLockup'
import { Icon } from '../../components/ui/Icon'
import { useTheme } from '../../theme/ThemeProvider'
import styles from './chrome.module.css'

/** Shared header/footer for every presentation variant. */
export function PresentationChrome({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <BrandLockup size="auth" />
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
          </button>
          <Link to="/login" className={styles.login}>
            Entrar
          </Link>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <BrandLockup size="nav" />
        <p>
          <a href="https://conora.com.br/privacidade" target="_blank" rel="noreferrer">
            Privacidade
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://conora.com.br/termos" target="_blank" rel="noreferrer">
            Termos
          </a>
        </p>
      </footer>
    </div>
  )
}
