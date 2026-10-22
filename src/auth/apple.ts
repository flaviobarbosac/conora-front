import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { isAndroidApp, isIosApp } from '../lib/platform'

export type AppleSignInResult = {
  identityToken: string
  email?: string | null
  name?: string | null
}

const APPLE_JS = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void
        signIn: () => Promise<{
          authorization: { id_token: string; code?: string }
          user?: { email?: string; name?: { firstName?: string; lastName?: string } }
        }>
      }
    }
  }
}

let appleJsPromise: Promise<void> | null = null

function servicesId(): string | undefined {
  const value = import.meta.env.VITE_APPLE_SERVICES_ID as string | undefined
  return value?.trim() || undefined
}

function bundleId(): string | undefined {
  const value = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined
  return value?.trim() || undefined
}

export function appleRedirectUri(): string {
  const configured = import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined
  if (configured?.trim()) {
    return configured.trim()
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${window.location.origin}${base}/login`
}

export function appleSignInAvailable(): boolean {
  if (isAndroidApp()) {
    return false
  }
  if (isIosApp()) {
    return Boolean(bundleId())
  }
  return Boolean(servicesId())
}

function loadAppleJs(): Promise<void> {
  if (window.AppleID?.auth) {
    return Promise.resolve()
  }
  if (appleJsPromise) {
    return appleJsPromise
  }

  appleJsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-apple-auth]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Apple.')))
      if (window.AppleID?.auth) {
        resolve()
      }
      return
    }

    const script = document.createElement('script')
    script.src = APPLE_JS
    script.async = true
    script.dataset.appleAuth = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Apple.'))
    document.head.appendChild(script)
  })

  return appleJsPromise
}

function displayName(first?: string | null, last?: string | null): string | null {
  const name = [first?.trim(), last?.trim()].filter(Boolean).join(' ')
  return name || null
}

async function authorizeViaAppleJs(): Promise<AppleSignInResult> {
  const clientId = servicesId()
  if (!clientId) {
    throw new Error('Entrar com Apple ainda não está configurado neste ambiente.')
  }

  await loadAppleJs()
  if (!window.AppleID?.auth) {
    throw new Error('Apple Sign In indisponível neste navegador.')
  }

  window.AppleID.auth.init({
    clientId,
    redirectURI: appleRedirectUri(),
    scope: 'name email',
    usePopup: true,
  })

  const result = await window.AppleID.auth.signIn()
  const identityToken = result.authorization?.id_token
  if (!identityToken) {
    throw new Error('Token Apple ausente.')
  }

  return {
    identityToken,
    email: result.user?.email ?? null,
    name: displayName(result.user?.name?.firstName, result.user?.name?.lastName),
  }
}

async function authorizeViaNativeIos(): Promise<AppleSignInResult> {
  const clientId = bundleId()
  if (!clientId) {
    throw new Error('Entrar com Apple ainda não está configurado neste ambiente.')
  }

  const result = await SignInWithApple.authorize({
    clientId,
    redirectURI: appleRedirectUri(),
    scopes: 'email name',
  })
  const identityToken = result.response.identityToken
  if (!identityToken) {
    throw new Error('Token Apple ausente.')
  }

  return {
    identityToken,
    email: result.response.email,
    name: displayName(result.response.givenName, result.response.familyName),
  }
}

export type AppleRevocationGrant = {
  appleAuthorizationCode: string
  appleClient: 'ios' | 'web'
  appleRedirectUri?: string
}

/**
 * Asks Apple for a fresh authorization code so the backend can revoke the
 * Sign in with Apple grant when the account is deleted (App Store guideline 5.1.1(v)).
 */
export async function requestAppleRevocationGrant(): Promise<AppleRevocationGrant> {
  if (!appleSignInAvailable()) {
    throw new Error('Entrar com Apple ainda não está configurado neste ambiente.')
  }

  if (isIosApp()) {
    const result = await SignInWithApple.authorize({
      clientId: bundleId()!,
      redirectURI: appleRedirectUri(),
      scopes: '',
    })
    const code = result.response.authorizationCode
    if (!code) {
      throw new Error('Código Apple ausente.')
    }
    return { appleAuthorizationCode: code, appleClient: 'ios' }
  }

  await loadAppleJs()
  if (!window.AppleID?.auth) {
    throw new Error('Apple Sign In indisponível neste navegador.')
  }
  const redirectURI = appleRedirectUri()
  window.AppleID.auth.init({ clientId: servicesId(), redirectURI, scope: '', usePopup: true })
  const result = await window.AppleID.auth.signIn()
  const code = result.authorization?.code
  if (!code) {
    throw new Error('Código Apple ausente.')
  }
  return { appleAuthorizationCode: code, appleClient: 'web', appleRedirectUri: redirectURI }
}

export async function requestAppleIdentityToken(): Promise<AppleSignInResult> {
  if (!appleSignInAvailable()) {
    throw new Error('Entrar com Apple ainda não está configurado neste ambiente.')
  }
  if (isIosApp()) {
    return authorizeViaNativeIos()
  }
  return authorizeViaAppleJs()
}
