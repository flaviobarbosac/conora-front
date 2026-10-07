const ACCESS_KEY = 'onra.accessToken'
const REFRESH_KEY = 'onra.refreshToken'

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

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY) ?? localStorage.getItem(ACCESS_KEY)
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
  sessionStorage.setItem(ACCESS_KEY, auth.accessToken)
  localStorage.setItem(ACCESS_KEY, auth.accessToken)
  localStorage.setItem(REFRESH_KEY, auth.refreshToken)
}

export function clearSession(): void {
  sessionStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
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

async function refreshAccessToken(): Promise<boolean> {
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
  return { blob: await response.blob(), fileName: match?.[1] ? decodeURIComponent(match[1]) : 'conora-export' }
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
