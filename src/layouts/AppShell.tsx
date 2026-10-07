import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { familyApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { BrandLockup } from '../components/BrandLockup'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { PREFERENCES_CHANGED, readSidebarCollapsed, writeSidebarCollapsed } from '../lib/preferences'
import { CADASTROS_ITEMS, NAV_ITEMS } from '../nav'
import { useTheme } from '../theme/ThemeProvider'
import styles from './AppShell.module.css'

function initialsFrom(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || 'ON'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase() || 'ON'
}

function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      className={className}
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
    </button>
  )
}

export function AppShell() {
  const { session, logout } = useAuth()
  const { pathname } = useLocation()
  const email = session?.email || 'conta'
  const profile = useLoad(() => familyApi.profile(), [session?.email])
  const displayName = profile.data?.name?.trim() || email
  const [cadastrosOpen, setCadastrosOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [railViewport, setRailViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1199px)').matches,
  )

  useEffect(() => {
    writeSidebarCollapsed(sidebarCollapsed)
  }, [sidebarCollapsed])

  useEffect(() => {
    function onPreferences() {
      setSidebarCollapsed(readSidebarCollapsed())
    }
    window.addEventListener(PREFERENCES_CHANGED, onPreferences)
    return () => window.removeEventListener(PREFERENCES_CHANGED, onPreferences)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1199px)')
    const apply = () => setRailViewport(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const brandCompact = sidebarCollapsed || railViewport

  const cadastrosActive = CADASTROS_ITEMS.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))

  const shellClass = [styles.shell, sidebarCollapsed ? styles.shellCollapsed : ''].filter(Boolean).join(' ')
  const sidebarClass = [styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : ''].filter(Boolean).join(' ')

  return (
    <div className={shellClass}>
      <aside className={sidebarClass}>
        <div className={styles.sidebarHead}>
          <BrandLockup size="nav" compact={brandCompact} />
          <button
            type="button"
            className={styles.collapseBtn}
            aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            <Icon
              name="chevron"
              size={20}
              className={sidebarCollapsed ? styles.chevronCollapsed : styles.chevronExpanded}
            />
          </button>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} variant={isActive ? 'duo' : 'linear'} size={24} />
                  <span className={styles.linkLabel}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <div className={styles.cadastros}>
            <button
              type="button"
              className={cadastrosActive ? styles.cadastrosToggleActive : styles.cadastrosToggle}
              aria-expanded={cadastrosOpen}
              aria-controls="nav-cadastros"
              title={sidebarCollapsed ? 'Cadastros' : undefined}
              onClick={() => setCadastrosOpen((open) => !open)}
            >
              <Icon name="folder" variant={cadastrosActive ? 'duo' : 'linear'} size={24} />
              <span className={styles.linkLabel}>Cadastros</span>
              <Icon
                name="chevron"
                size={16}
                decorative
                className={[styles.cadastrosChevron, cadastrosOpen ? styles.cadastrosChevronOpen : ''].filter(Boolean).join(' ')}
              />
            </button>
            {cadastrosOpen ? (
              <div id="nav-cadastros" className={styles.cadastrosItems}>
                {CADASTROS_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => (isActive ? styles.cadastrosLinkActive : styles.cadastrosLink)}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon name={item.icon} variant={isActive ? 'duo' : 'linear'} size={20} />
                        <span className={styles.linkLabel}>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        </nav>
        <div className={styles.sidebarFoot}>
          <NavLink
            to="/configuracoes"
            className={({ isActive }) => (isActive ? styles.settingsLinkActive : styles.settingsLink)}
            title={sidebarCollapsed ? 'Configurações' : undefined}
          >
            {({ isActive }) => (
              <>
                <Icon name="settings" variant={isActive ? 'duo' : 'linear'} size={24} />
                <span className={styles.linkLabel}>Configurações</span>
              </>
            )}
          </NavLink>
          <span className={styles.appVersion} title={`Versão ${__APP_VERSION__}`}>
            v{__APP_VERSION__}
          </span>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.appHeader}>
          <div className={styles.appHeaderBrand}>
            <BrandLockup size="nav" />
          </div>
          <div className={styles.appHeaderUser}>
            <div className={styles.avatar} aria-hidden="true">
              {initialsFrom(displayName, email)}
            </div>
            <div className={styles.profileMeta}>
              <strong title={displayName}>{displayName}</strong>
              <span title={email}>{email}</span>
            </div>
          </div>
          <div className={styles.appHeaderActions}>
            <ThemeToggleButton className={styles.themeBtn} />
            <button className={styles.iconBtn} type="button" onClick={() => void logout()} aria-label="Sair da conta">
              Sair
            </button>
          </div>
        </header>

        <main className={styles.main} id="conteudo-principal">
          <Outlet />
        </main>
      </div>

      <nav className={styles.bottomNav} aria-label="Atalhos">
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
        <NavLink to="/lancamentos?novo=1" className={styles.fab} aria-label="Novo lançamento">
          <span className={styles.fabDisc}>
            <Icon name="add" variant="tile" size={20} />
          </span>
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
