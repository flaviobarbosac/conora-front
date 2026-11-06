const GOOGLE_SRC = 'https://accounts.google.com/gsi/client'

type GoogleTokenResponse = {
  access_token?: string
  error?: string
}

type GoogleTokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void
}

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        scope: string
        callback: (response: GoogleTokenResponse) => void
      }) => GoogleTokenClient
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
    Capacitor?: { isNativePlatform?: () => boolean }
  }
}

function googlePopupMessage(error: string | undefined): string {
  if (error === 'popup_closed_by_user' || error === 'access_denied') {
    return 'Seleção da conta Google cancelada.'
  }
  if (error === 'popup_failed_to_open') {
    return 'Não foi possível abrir o seletor do Google. Permita pop-ups neste site.'
  }
  return 'Não foi possível abrir o seletor do Google.'
}

function isNativeApp(): boolean {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true
}

function loadScript(): Promise<void> {
  if (window.google?.accounts.oauth2) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google')))
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Google'))
    document.head.appendChild(script)
  })
}

let nativeGoogleReady: Promise<void> | null = null

/** Initializes Capgo SocialLogin Google provider on native (iOS/Android). */
export function ensureNativeGoogleAuth(): Promise<void> {
  if (nativeGoogleReady) {
    return nativeGoogleReady
  }

  nativeGoogleReady = (async () => {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) {
      return
    }

    const webClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
    const iOSClientId = (import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined)?.trim()
    if (!webClientId) {
      throw new Error('Google ainda não está configurado neste ambiente.')
    }

    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    await SocialLogin.initialize({
      google: {
        webClientId,
        iOSClientId: iOSClientId || undefined,
        iOSServerClientId: webClientId,
        mode: 'online',
      },
    })
  })()

  return nativeGoogleReady
}

export function requestGoogleIdToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (!clientId) {
    return Promise.reject(new Error('Google ainda não está configurado neste ambiente.'))
  }

  if (!isNativeApp()) {
    return openGoogleAccountPicker(clientId)
  }

  return requestNativeGoogleIdToken()
}

async function requestNativeGoogleIdToken(): Promise<string> {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) {
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
    if (!clientId) {
      throw new Error('Google ainda não está configurado neste ambiente.')
    }
    return openGoogleAccountPicker(clientId)
  }

  await ensureNativeGoogleAuth()
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
      prompt: 'select_account',
      forcePrompt: true,
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
      style: 'standard',
    },
  })
  if (response.provider !== 'google') {
    throw new Error('Token Google ausente.')
  }
  const result = response.result
  const idToken = 'idToken' in result ? result.idToken : null
  if (!idToken) {
    throw new Error('Token Google ausente.')
  }
  return idToken
}

if (!isNativeApp()) {
  void loadScript()
}

function openGoogleAccountPicker(clientId: string): Promise<string> {
  if (!window.google?.accounts.oauth2) {
    return loadScript().then(() => openGoogleAccountPicker(clientId))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let watch = 0
    const originalOpen = window.open.bind(window)
    const finish = (action: () => void) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timer)
      window.clearInterval(watch)
      window.open = originalOpen
      action()
    }

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('Seleção da conta Google cancelada.')))
    }, 180000)

    window.open = ((...args: Parameters<typeof window.open>) => {
      const popup = originalOpen(...args)
      if (popup) {
        watch = window.setInterval(() => {
          if (!popup.closed) {
            return
          }
          window.clearInterval(watch)
          window.setTimeout(() => {
            finish(() => reject(new Error('Seleção da conta Google cancelada.')))
          }, 700)
        }, 400)
      }
      return popup
    }) as typeof window.open

    const google = window.google
    if (!google?.accounts.oauth2) {
      finish(() => reject(new Error('Google Identity não disponível.')))
      return
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => {
        finish(() => {
          if (response.access_token) {
            resolve(response.access_token)
            return
          }
          reject(new Error(googlePopupMessage(response.error)))
        })
      },
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })
}
