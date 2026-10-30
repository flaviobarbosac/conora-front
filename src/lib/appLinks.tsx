import { App } from '@capacitor/app'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { AuthLayout } from '../layouts/AuthLayout'
import styles from '../pages/auth.module.css'
import { isNativeApp } from './platform'

/** E-mail link pages the app can open through HTTPS App/Universal Links or conora://. */
export type AppLinkPage = 'validar-email' | 'redefinir-senha'

const APP_LINK_PAGES: readonly string[] = ['validar-email', 'redefinir-senha'] satisfies AppLinkPage[]
const APP_LINK_HOSTS = new Set(['conora.com.br', 'www.conora.com.br'])

/** Detect mobile browser (not native app, but mobile web). */
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/** Same cold-start URL must not re-route after Voltar ao login / second appUrlOpen. */
const handledAppRoutes = new Set<string>()

function appUrl(page: AppLinkPage, token: string): string {
  return `conora://${page}?token=${encodeURIComponent(token)}`
}

function pageFromPath(pathname: string): AppLinkPage | null {
  const trimmed = pathname.replace(/\/+$/, '')
  const match = trimmed.match(/^\/app\/([^/]+)$/)
  const page = match?.[1]
  return page && APP_LINK_PAGES.includes(page) ? (page as AppLinkPage) : null
}

/** Maps conora://… or https://conora.com.br/app/…?token=… to the in-app route. */
export function appLinkRoute(url: string): string | null {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    if (!token) return null

    if (parsed.protocol === 'conora:') {
      if (!APP_LINK_PAGES.includes(parsed.host)) return null
      return `/${parsed.host}?token=${encodeURIComponent(token)}`
    }

    if (parsed.protocol === 'https:' && APP_LINK_HOSTS.has(parsed.hostname)) {
      const page = pageFromPath(parsed.pathname)
      if (!page) return null
      return `/${page}?token=${encodeURIComponent(token)}`
    }

    return null
  } catch {
    return null
  }
}

/** Mark a deep-link route as consumed so getLaunchUrl will not send the user back. */
export function consumeAppLinkRoute(route: string): void {
  handledAppRoutes.add(route)
}

/** Native app: routes e-mail links (HTTPS + conora://) on cold start and while running. */
export function listenAppLinks(onRoute: (route: string) => void): () => void {
  if (!isNativeApp()) return () => {}
  let cancelled = false

  function deliver(rawUrl: string): void {
    const route = appLinkRoute(rawUrl)
    if (!route || cancelled) return
    if (handledAppRoutes.has(route)) return
    handledAppRoutes.add(route)
    onRoute(route)
  }

  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) deliver(launch.url)
  })
  const handle = App.addListener('appUrlOpen', (event) => {
    deliver(event.url)
  })
  return () => {
    cancelled = true
    void handle.then((listener) => listener.remove())
  }
}

/**
 * When a HTTPS e-mail link opens in the browser:
 * - Desktop web: consume token directly, never show app option
 * - Mobile web: redirect to conora:// immediately, show fallback UI after timeout
 * - Native app: consume token directly (handled by VerifyEmailPage)
 *
 * This ensures the token is used only once: either by the browser or the app,
 * never by both. Mobile web redirects to the app without calling the API first.
 */
export function useAppHandoff(page: AppLinkPage) {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const forceWeb = searchParams.get('web') === '1'
  const mobile = isMobileBrowser()
  const url = appUrl(page, token)

  // Desktop web or forceWeb: no handoff, consume token in browser
  // Mobile web without forceWeb: redirect to app, show fallback UI if redirect fails
  const shouldHandoff = !isNativeApp() && !!token && !forceWeb && mobile
  const [handoff, setHandoff] = useState(shouldHandoff)
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    if (!shouldHandoff) return

    // Mobile web: redirect to app immediately
    window.location.href = url

    // If the page is still here after 1.5s, the app probably isn't installed
    // or the redirect was blocked. Show fallback UI.
    const timeout = setTimeout(() => {
      setShowFallback(true)
    }, 1500)

    return () => clearTimeout(timeout)
  }, [shouldHandoff, url])

  return {
    // Show handoff UI only as fallback when redirect didn't work
    handoff: handoff && showFallback,
    // Block API call while redirecting to app (before fallback timeout)
    redirectingToApp: handoff && !showFallback,
    url,
    continueInBrowser: () => {
      setHandoff(false)
      const next = new URL(window.location.href)
      next.searchParams.set('web', '1')
      window.location.replace(next.toString())
    },
  }
}

export function AppHandoff({ url, onContinue }: { url: string; onContinue: () => void }) {
  return (
    <AuthLayout title="Abrir no app Conora" subtitle="Você começou pelo aplicativo. Continue por lá.">
      <div className={styles.actions}>
        <Button onClick={() => (window.location.href = url)}>Abrir no app Conora</Button>
        <Button variant="ghost" onClick={onContinue}>
          Continuar no navegador
        </Button>
      </div>
    </AuthLayout>
  )
}
