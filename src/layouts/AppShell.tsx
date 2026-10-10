import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { familyApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { scanReceipt } from '../camera/scanReceipt'
import { AlertsBell } from '../components/AlertsBell'
import { BrandLockup } from '../components/BrandLockup'
import { Skeleton } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { PREFERENCES_CHANGED, readSidebarCollapsed, writeSidebarCollapsed } from '../lib/preferences'
import { CADASTROS_ITEMS, NAV_ITEMS } from '../nav'
import { ThemeName, useTheme } from '../theme/ThemeProvider'
import styles from './AppShell.module.css'

function initialsFrom(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || 'ON'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return source.slice(0, 2).toUpperCase() || 'ON'
}

export function AppShell() {
  const { session, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const email = session?.email || 'conta'
  const profile = useLoad(() => familyApi.profile(), [session?.email])
  const displayName = profile.data?.name?.trim() || email

  useEffect(() => {
    const onProfileChanged = () => profile.reload()
    window.addEventListener('conora:profile-changed', onProfileChanged)
    return () => window.removeEventListener('conora:profile-changed', onProfileChanged)
  }, [profile.reload])
  const [cadastrosOpen, setCadastrosOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    setProfileMenuOpen(false)
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!profileMenuOpen && !mobileNavOpen) {
      return
    }
    function onPointerDown(event: MouseEvent) {
      if (profileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
        setMobileNavOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileMenuOpen, mobileNavOpen])

  useEffect(() => {
    if (!mobileNavOpen) {
      return
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileNavOpen])

  const brandCompact = !mobileNavOpen && (sidebarCollapsed || railViewport)

  const cadastrosActive = CADASTROS_ITEMS.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))

  const shellClass = [styles.shell, sidebarCollapsed ? styles.shellCollapsed : ''].filter(Boolean).join(' ')
  const sidebarClass = [
    styles.sidebar,
    sidebarCollapsed && !mobileNavOpen ? styles.sidebarCollapsed : '',
    mobileNavOpen ? styles.sidebarMobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ')

  async function openCameraEntry() {
    try {
      await scanReceipt()
      navigate('/lancamentos?novo=1&recibo=1')
    } catch {
      // User cancelled the camera/gallery prompt.
    }
  }

  return (
    <div className={shellClass}>
      {mobileNavOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Fechar menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <aside className={sidebarClass} id="menu-lateral">
        <div className={styles.sidebarHead}>
          <BrandLockup size="nav" compact={brandCompact} />
          <button
            type="button"
            className={styles.collapseBtn}
            aria-label={
              mobileNavOpen
                ? 'Fechar menu'
                : sidebarCollapsed
                  ? 'Expandir menu lateral'
                  : 'Recolher menu lateral'
            }
            aria-expanded={mobileNavOpen ? true : !sidebarCollapsed}
            onClick={() => {
              if (mobileNavOpen) {
                setMobileNavOpen(false)
                return
              }
              setSidebarCollapsed((value) => !value)
            }}
          >
            <Icon
              name="chevron"
              size={20}
              className={
                mobileNavOpen || !sidebarCollapsed ? styles.chevronExpanded : styles.chevronCollapsed
              }
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
              title={sidebarCollapsed && !mobileNavOpen ? item.label : undefined}
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
              className={
                cadastrosActive || cadastrosOpen ? styles.cadastrosToggleActive : styles.cadastrosToggle
              }
              aria-expanded={cadastrosOpen}
              aria-controls="nav-cadastros"
              title={sidebarCollapsed && !mobileNavOpen ? 'Cadastros' : undefined}
              onClick={() => setCadastrosOpen((open) => !open)}
            >
              <Icon name="folder" variant={cadastrosActive || cadastrosOpen ? 'duo' : 'linear'} size={24} />
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
                    title={sidebarCollapsed && !mobileNavOpen ? item.label : undefined}
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
          <span className={styles.appVersion} title={`Versão ${__APP_VERSION__}`}>
            v{__APP_VERSION__}
          </span>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.appHeader}>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label="Abrir menu"
            aria-controls="menu-lateral"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <Icon name="menu" size={24} />
          </button>
          <div className={styles.appHeaderBrand}>
            <BrandLockup size="nav" />
          </div>
          <div className={styles.appHeaderUser} ref={profileMenuRef}>
            <AlertsBell peerOpen={profileMenuOpen} onOpen={() => setProfileMenuOpen(false)} />
            <button
              type="button"
              className={styles.avatarBtn}
              aria-label="Menu do perfil"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              onClick={() => setProfileMenuOpen((open) => !open)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initialsFrom(displayName, email)}
              </span>
            </button>
            <div className={styles.profileMeta}>
              <strong title={displayName}>{displayName}</strong>
              <span title={email}>{email}</span>
            </div>
            {profileMenuOpen ? (
              <div className={styles.profileMenu} role="menu" aria-label="Conta">
                <Link
                  to="/configuracoes#perfil"
                  className={styles.profileMenuItem}
                  role="menuitem"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <Icon name="user" size={20} />
                  Perfil
                </Link>
                <button
                  type="button"
                  className={styles.profileMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setTheme(theme === ThemeName.Light ? ThemeName.Dark : ThemeName.Light)
                    setProfileMenuOpen(false)
                  }}
                >
                  <Icon name={theme === ThemeName.Light ? 'moon' : 'sun'} size={20} />
                  {theme === ThemeName.Light ? 'Escuro' : 'Claro'}
                </button>
                <Link
                  to="/plano"
                  className={styles.profileMenuItem}
                  role="menuitem"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <Icon name="card" size={20} />
                  Plano
                </Link>
                <Link
                  to="/ajuda"
                  className={styles.profileMenuItem}
                  role="menuitem"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <Icon name="help" size={20} />
                  Central de ajuda
                </Link>
                <button
                  type="button"
                  className={styles.profileMenuItemDanger}
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    void logout()
                  }}
                >
                  <Icon name="logout" size={20} />
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className={styles.main} id="conteudo-principal">
          <Suspense
            fallback={
              <div aria-busy="true" aria-live="polite">
                <Skeleton height={140} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
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
        <button type="button" className={styles.fab} aria-label="Fotografar recibo" onClick={() => void openCameraEntry()}>
          <span className={styles.fabDisc}>
            <Icon name="camera" variant="tile" size={24} />
          </span>
        </button>
        <NavLink to="/raio-x" className={({ isActive }) => (isActive ? styles.bottomLinkActive : styles.bottomLink)}>
          {({ isActive }) => (
            <>
              <Icon name="budget" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Raio-X</span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          className={mobileNavOpen || cadastrosActive ? styles.bottomLinkActive : styles.bottomLink}
          aria-label="Abrir menu Cadastros e Orçamento"
          aria-expanded={mobileNavOpen}
          aria-controls="menu-lateral"
          onClick={() => setMobileNavOpen(true)}
        >
          <Icon name="menu" variant={mobileNavOpen || cadastrosActive ? 'duo' : 'linear'} size={24} />
          <span>Menu</span>
        </button>
      </nav>
      <span className={styles.mobileVersion} title={`Versão ${__APP_VERSION__}`}>
        v{__APP_VERSION__}
      </span>
    </div>
  )
}
