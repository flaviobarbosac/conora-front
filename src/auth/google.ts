const GOOGLE_SRC = 'https://accounts.google.com/gsi/client'

type PromptNotification = {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  isDismissedMoment: () => boolean
  getNotDisplayedReason: () => string
  getSkippedReason: () => string
  getDismissedReason: () => string
}

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
      prompt: (moment?: (notification: PromptNotification) => void) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

function googlePromptMessage(reason: string): string {
  if (reason === 'opt_out_or_no_session' || reason === 'suppressed_by_user') {
    return 'Nenhuma conta Google disponível neste navegador.'
  }
  return 'Não foi possível abrir o login do Google.'
}

function loadScript(): Promise<void> {
  if (window.google?.accounts.id) {
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

export async function requestGoogleIdToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (!clientId) {
    throw new Error('Google ainda não está configurado neste ambiente.')
  }

  await loadScript()
  if (!window.google) {
    throw new Error('Google Identity não disponível.')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (action: () => void) => {
      if (settled) {
        return
      }
      settled = true
      action()
    }

    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        finish(() => {
          if (response.credential) {
            resolve(response.credential)
            return
          }
          reject(new Error('Token Google ausente.'))
        })
      },
    })
    window.google!.accounts.id.prompt((notification) => {
      if (notification.isDismissedMoment()) {
        if (notification.getDismissedReason() === 'credential_returned') {
          return
        }
        finish(() => reject(new Error(googlePromptMessage(notification.getDismissedReason()))))
        return
      }
      if (!notification.isNotDisplayed() && !notification.isSkippedMoment()) {
        return
      }
      const reason = notification.isNotDisplayed()
        ? notification.getNotDisplayedReason()
        : notification.getSkippedReason()
      finish(() => reject(new Error(googlePromptMessage(reason))))
    })
  })
}
