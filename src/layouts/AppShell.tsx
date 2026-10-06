import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { BrandLockup } from '../components/BrandLockup'
import { Icon } from '../components/ui/Icon'
import { NAV_ITEMS } from '../nav'
import { useTheme } from '../theme/ThemeProvider'
import styles from './AppShell.module.css'

function initials(email: string): string {
  const local = email.split('@')[0] ?? 'ON'
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase() || 'ON'
}

export function AppShell() {
  const { session, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const email = session?.email || 'conta'

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <BrandLockup size="nav" />
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} variant={isActive ? 'duo' : 'linear'} size={24} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={styles.profile}>
          <div className={styles.avatar}>{initials(email)}</div>
          <div className={styles.profileMeta}>
            <strong>{email}</strong>
            <span>Família</span>
          </div>
          <div className={styles.profileActions}>
            <button className={styles.iconBtn} type="button" onClick={toggleTheme}>
              {theme === 'dark' ? 'Clareza' : 'Noite'}
            </button>
            <button className={styles.iconBtn} type="button" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav className={styles.bottomNav} aria-label="Principal">
        <NavLink to="/" end className={({ isActive }) => (isActive ? styles.bottomLinkActive : styles.bottomLink)}>
          {({ isActive }) => (
            <>
              <Icon name="home" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Início</span>
            </>
          )}
        </NavLink>
        <NavLink to="/lancamentos" className={({ isActive }) => (isActive ? styles.bottomLinkActive : styles.bottomLink)}>
          {({ isActive }) => (
            <>
              <Icon name="list" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Lançar</span>
            </>
          )}
        </NavLink>
        <NavLink to="/lancamentos" className={styles.fab} aria-label="Novo lançamento">
          <Icon name="add" variant="tile" size={20} />
        </NavLink>
        <NavLink to="/orcamento" className={({ isActive }) => (isActive ? styles.bottomLinkActive : styles.bottomLink)}>
          {({ isActive }) => (
            <>
              <Icon name="budget" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Orçamento</span>
            </>
          )}
        </NavLink>
        <NavLink to="/relatorios" className={({ isActive }) => (isActive ? styles.bottomLinkActive : styles.bottomLink)}>
          {({ isActive }) => (
            <>
              <Icon name="search" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Mais</span>
            </>
          )}
        </NavLink>
      </nav>
    </div>
  )
}
