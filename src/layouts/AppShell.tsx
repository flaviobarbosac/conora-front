import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { familyApi, gamificationApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { isConsoleOperator } from '../auth/consoleAccess'
import { AlertsBell } from '../components/AlertsBell'
import { BrandLockup } from '../components/BrandLockup'
import { FeedbackOverlay } from '../components/FeedbackOverlay'
import { FeedbackReplyListener } from '../components/FeedbackReplyListener'
import { IanFloatingChat } from '../components/IanFloatingChat'
import { PlanBanner } from '../components/PlanBanner'
import { Skeleton } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { trackJourney } from '../lib/journeyTrack'
import { PREFERENCES_CHANGED, readSidebarCollapsed, writeSidebarCollapsed } from '../lib/preferences'
import { applyIanMaturity, maturityAgeFromAchievements } from '../lib/speakPt'
import { CADASTROS_ITEMS, NAV_ITEMS } from '../nav'
import { ALL_THEMES, type ThemeId } from '../theme/themes'
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

export function AppShell() {
  const { session, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { pathname } = useLocation()
  const email = session?.email || 'conta'
  const profile = useLoad(() => familyApi.profile(), [session?.email])
  const displayName = profile.data?.name?.trim() || email

  useEffect(() => {
    const onProfileChanged = () => profile.reload()
    window.addEventListener('conora:profile-changed', onProfileChanged)
    return () => window.removeEventListener('conora:profile-changed', onProfileChanged)
  }, [profile.reload])

  useEffect(() => {
    if (profile.data?.themeId) {
      setTheme(profile.data.themeId)
    }
  }, [profile.data?.themeId, setTheme])

  useEffect(() => {
    const prefs = profile.data
    if (!prefs) return
    let cancelled = false
    void gamificationApi.achievements().then((data) => {
      if (cancelled) return
      applyIanMaturity(maturityAgeFromAchievements(data.items), {
        quiet: prefs.quietMode,
        photoEvolutionEnabled: prefs.photoEvolutionEnabled !== false,
      })
    }).catch(() => {
      if (cancelled) return
      applyIanMaturity(0, {
        quiet: prefs.quietMode,
        photoEvolutionEnabled: prefs.photoEvolutionEnabled !== false,
      })
    })
    return () => {
      cancelled = true
    }
  }, [
    profile.data?.quietMode,
    profile.data?.photoEvolutionEnabled,
    profile.data?.usuarioId,
  ])
  const [cadastrosOpen, setCadastrosOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [themesMenuOpen, setThemesMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackPath, setFeedbackPath] = useState<string | undefined>()
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
    setThemesMenuOpen(false)
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!session) return
    trackJourney(pathname, 'Navigate')
  }, [pathname, session])

  async function applyTheme(themeId: ThemeId) {
    setTheme(themeId)
    const current = profile.data
    if (!current) {
      return
    }
    try {
      await familyApi.updatePreferences({
        themeId,
        quietMode: current.quietMode,
        emailsEnabled: current.emailsEnabled ?? true,
        reserveTargetMonths: current.reserveTargetMonths,
        monthCloseDay: current.monthCloseDay,
        includeAbsoluteValuesInRetrospective: current.includeAbsoluteValuesInRetrospective,
        voiceEntryConfirm: current.voiceEntryConfirm !== false,
        budgetAlertPercent: current.budgetAlertPercent ?? 70,
        photoEvolutionEnabled: current.photoEvolutionEnabled !== false,
      })
      profile.reload()
      window.dispatchEvent(new Event('conora:profile-changed'))
    } catch {
      // Preview stays; profile reload will restore server theme if save failed.
    }
    // Keep profile menu + themes list open so the user can try another theme fluidly.
  }

  useEffect(() => {
    if (!profileMenuOpen && !mobileNavOpen) {
      return
    }
    function onPointerDown(event: MouseEvent) {
      if (profileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
        setThemesMenuOpen(false)
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
          {isConsoleOperator(email) ? (
            <NavLink
              to="/console/metodo"
              className={({ isActive }) => (isActive ? styles.settingsLinkActive : styles.settingsLink)}
              title={sidebarCollapsed && !mobileNavOpen ? 'Console' : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon name="console" variant={isActive ? 'duo' : 'linear'} size={24} />
                  <span className={styles.linkLabel}>Console</span>
                </>
              )}
            </NavLink>
          ) : null}
          <NavLink
            to="/configuracoes"
            className={({ isActive }) => (isActive ? styles.settingsLinkActive : styles.settingsLink)}
            title={sidebarCollapsed && !mobileNavOpen ? 'Configurações' : undefined}
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
          {pathname !== '/' ? (
            <div id="conora-voice-header" className={styles.appHeaderVoice} />
          ) : null}
          <div className={styles.appHeaderUser} ref={profileMenuRef}>
            <AlertsBell peerOpen={profileMenuOpen} onOpen={() => setProfileMenuOpen(false)} />
            <button
              type="button"
              className={styles.avatarBtn}
              aria-label="Enviar feedback"
              title="Feedback"
              onClick={() => {
                setFeedbackPath(pathname)
                setFeedbackOpen(true)
              }}
            >
              <Icon name="pen" size={20} />
            </button>
            <button
              type="button"
              className={styles.avatarBtn}
              aria-label="Menu do perfil"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              onClick={() =>
                setProfileMenuOpen((open) => {
                  const next = !open
                  if (!next) setThemesMenuOpen(false)
                  return next
                })
              }
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
                  to="/perfil"
                  className={styles.profileMenuItem}
                  role="menuitem"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <Icon name="user" size={20} />
                  Perfil
                </Link>
                <div className={styles.themesItemWrap}>
                  <button
                    type="button"
                    className={styles.profileMenuItem}
                    role="menuitem"
                    aria-expanded={themesMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setThemesMenuOpen((open) => !open)}
                  >
                    <Icon name={theme === 'noite' || theme === 'contraste' ? 'moon' : 'sun'} size={20} />
                    Temas
                    <Icon
                      name="chevron"
                      size={16}
                      className={
                        themesMenuOpen ? `${styles.themesChevron} ${styles.themesChevronOpen}` : styles.themesChevron
                      }
                    />
                  </button>
                  {themesMenuOpen ? (
                    <div className={styles.themesMenuInline} role="menu" aria-label="Temas">
                      {ALL_THEMES.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={theme === item.id}
                          className={theme === item.id ? styles.profileMenuItemActive : styles.profileMenuItem}
                          onClick={() => void applyTheme(item.id)}
                        >
                          <span className={styles.themeSwatch} data-theme-preview={item.id} aria-hidden />
                          <span className={styles.themeOptionText}>
                            <strong>{item.label}</strong>
                            <span>{item.climate}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
                  className={styles.profileMenuItem}
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false)
                    setFeedbackPath(pathname)
                    setFeedbackOpen(true)
                  }}
                >
                  <Icon name="pen" size={20} />
                  Feedback
                </button>
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
          <PlanBanner />
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
        <NavLink to="/orcamento" className={({ isActive }) => (isActive ? styles.bottomLinkActive : styles.bottomLink)}>
          {({ isActive }) => (
            <>
              <Icon name="wallet" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Orçam.</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/raio-x"
          className={({ isActive }) =>
            isActive
              ? `${styles.bottomLinkActive} ${styles.bottomLinkFeature} ${styles.bottomLinkFeatureActive}`
              : `${styles.bottomLink} ${styles.bottomLinkFeature}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon name="budget" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Raio-X</span>
            </>
          )}
        </NavLink>
        <NavLink to="/categorias" className={({ isActive }) => (isActive ? styles.bottomLinkActive : styles.bottomLink)}>
          {({ isActive }) => (
            <>
              <Icon name="folder" variant={isActive ? 'duo' : 'linear'} size={24} />
              <span>Categorias</span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          className={mobileNavOpen ? styles.bottomLinkActive : styles.bottomLink}
          aria-label="Abrir menu"
          aria-controls="menu-lateral"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(true)}
        >
          <Icon name="menu" variant={mobileNavOpen ? 'duo' : 'linear'} size={24} />
          <span>Menu</span>
        </button>
      </nav>
      <IanFloatingChat />
      <FeedbackReplyListener />
      <FeedbackOverlay
        open={feedbackOpen}
        pathnameSnapshot={feedbackPath}
        onClose={() => {
          setFeedbackOpen(false)
          setFeedbackPath(undefined)
        }}
      />
    </div>
  )
}
