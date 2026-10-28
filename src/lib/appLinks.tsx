import { App } from '@capacitor/app'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { AuthLayout } from '../layouts/AuthLayout'
import styles from '../pages/auth.module.css'
import { isNativeApp } from './platform'

/** E-mail link pages the app can open through the conora:// scheme. */
export type AppLinkPage = 'validar-email' | 'redefinir-senha'

const APP_LINK_PAGES: readonly string[] = ['validar-email', 'redefinir-senha'] satisfies AppLinkPage[]

/** Same cold-start URL must not re-route after Voltar ao login / second appUrlOpen. */
const handledAppRoutes = new Set<string>()

function appUrl(page: AppLinkPage, token: string): string {
  return `conora://${page}?token=${encodeURIComponent(token)}`
}

/** Maps conora://validar-email?token=… to the in-app route, or null for other URLs. */
export function appLinkRoute(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'conora:' || !APP_LINK_PAGES.includes(parsed.host)) return null
    const token = parsed.searchParams.get('token')
    return token ? `/${parsed.host}?token=${encodeURIComponent(token)}` : null
  } catch {
    return null
  }
}

/** Mark a deep-link route as consumed so getLaunchUrl will not send the user back. */
export function consumeAppLinkRoute(route: string): void {
  handledAppRoutes.add(route)
}

/** Native app: routes e-mail links opened through conora:// (cold start and while running). */
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
 * The API adds app=1 to links for accounts that asked from the app. In a browser, offer
 * the app first so the token is used there; the user can still continue on the web.
 */
export function useAppHandoff(page: AppLinkPage) {
  const [searchParams] = useSearchParams()
  const token = (searchParams.get('token') ?? '').trim()
  const [handoff, setHandoff] = useState(() => searchParams.get('app') === '1' && !isNativeApp() && !!token)
  const url = appUrl(page, token)

  useEffect(() => {
    // Try once on load; mail apps may block it without a tap, so the button stays available.
    if (handoff) window.location.href = url
  }, [])

  return { handoff, url, continueInBrowser: () => setHandoff(false) }
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
