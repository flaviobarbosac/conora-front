const ACCESS_KEY = 'conora.accessToken'
const REFRESH_KEY = 'conora.refreshToken'
const LEGACY_ACCESS_KEY = 'onra.accessToken'
const LEGACY_REFRESH_KEY = 'onra.refreshToken'

export type AuthResponse = {
  userId: string
  email: string
  accessToken: string
  refreshToken: string
  accessExpiresAtUtc: string
}

function apiBase(): string {
  return import.meta.env.VITE_API_URL ?? ''
}

function migrateLegacyTokens(): void {
  const legacyAccess = localStorage.getItem(LEGACY_ACCESS_KEY)
  if (legacyAccess && !sessionStorage.getItem(ACCESS_KEY)) {
    sessionStorage.setItem(ACCESS_KEY, legacyAccess)
  }
  const legacyRefresh = localStorage.getItem(LEGACY_REFRESH_KEY)
  if (legacyRefresh && !localStorage.getItem(REFRESH_KEY)) {
    localStorage.setItem(REFRESH_KEY, legacyRefresh)
  }
  localStorage.removeItem(LEGACY_ACCESS_KEY)
  localStorage.removeItem(LEGACY_REFRESH_KEY)
  localStorage.removeItem(ACCESS_KEY)
}

migrateLegacyTokens()

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function emailFromAccessToken(token: string | null): string {
  if (!token) {
    return ''
  }

  try {
    const payload = token.split('.')[1]
    if (!payload) {
      return ''
    }

    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      email?: string
    }
    return json.email ?? ''
  } catch {
    return ''
  }
}

export function persistSession(auth: AuthResponse): void {
  // Access token stays in sessionStorage (cleared with tab; less XSS persistence surface).
  // Refresh stays in localStorage so the session can survive a reload in the same browser profile.
  sessionStorage.setItem(ACCESS_KEY, auth.accessToken)
  localStorage.setItem(REFRESH_KEY, auth.refreshToken)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(LEGACY_ACCESS_KEY)
  localStorage.removeItem(LEGACY_REFRESH_KEY)
}

export function clearSession(): void {
  sessionStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(LEGACY_ACCESS_KEY)
  localStorage.removeItem(LEGACY_REFRESH_KEY)
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { title?: string; detail?: string }
    return payload.detail ?? payload.title ?? response.statusText
  } catch {
    return response.statusText
  }
}

let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      return false
    }

    const response = await fetch(`${apiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      clearSession()
      return false
    }

    const auth = (await response.json()) as AuthResponse
    persistSession(auth)
    return true
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers()
  headers.set('Accept', 'application/json')
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const send = async (): Promise<Response> => {
    const token = options.auth === false ? null : getAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    } else {
      headers.delete('Authorization')
    }

    return fetch(`${apiBase()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  }

  let response = await send()
  if (response.status === 401 && options.auth !== false) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await send()
    }
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as T
}

export async function apiBlob(path: string): Promise<{ blob: Blob; fileName: string }> {
  const send = () => {
    const headers = new Headers()
    const token = getAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return fetch(`${apiBase()}${path}`, { headers })
  }

  let response = await send()
  if (response.status === 401 && (await refreshAccessToken())) {
    response = await send()
  }

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  return {
    blob: await response.blob(),
    fileName: match?.[1] ? decodeURIComponent(match[1]) : 'conora-export',
  }
}

export const authApi = {
  login: (usuario: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { usuario, password },
    }),
  register: (name: string, email: string, cpf: string, password: string) =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      auth: false,
      body: { name, email, cpf, password },
    }),
  google: (idToken: string) =>
    apiFetch<AuthResponse>('/auth/google', {
      method: 'POST',
      auth: false,
      body: { idToken },
    }),
  apple: (identityToken: string) =>
    apiFetch<AuthResponse>('/auth/apple', {
      method: 'POST',
      auth: false,
      body: { identityToken },
    }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
}
