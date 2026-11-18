import { apiFetch } from '../client'
import { json } from './helpers'

export type PushPlatform = 'ios' | 'android' | 'web'

export type PushTokenResponse = {
  id: string
  token: string
  platform: PushPlatform
  lastSeenAt: string
}

export const pushApi = {
  registerToken: (token: string, platform: PushPlatform) =>
    apiFetch<PushTokenResponse>('/push/tokens', json('POST', { token, platform })),
  unregisterToken: (token: string) =>
    apiFetch<void>('/push/tokens/unregister', json('POST', { token })),
  status: () => apiFetch<{ configured: boolean }>('/push/status'),
}
