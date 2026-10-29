import { apiFetch } from '../client'
import { query, json } from './helpers'
import type {
  FeedbackStatus,
  FeedbackItem,
  ConsoleFeedbackItem,
  ConsoleFeedbackUsuarioOption,
} from './types'
export const feedbackApi = {
  listMine: () => apiFetch<FeedbackItem[]>('/feedback'),
  getMine: (id: string) => apiFetch<FeedbackItem>(`/feedback/${id}`),
  submit: (payload: {
    modulo: string
    rota?: string | null
    plataforma: 'Web' | 'iOS' | 'Android'
    nota: number
    comentario: string
  }) => apiFetch<FeedbackItem>('/feedback', json('POST', payload)),
  markReplyRead: (id: string) => apiFetch<void>(`/feedback/${id}/leitura`, json('POST')),
  listConsole: (params: {
    usuarioId?: string
    status?: FeedbackStatus | number | ''
    from?: string
    to?: string
    modulo?: string
    nota?: number | ''
    take?: number
  }) =>
    apiFetch<ConsoleFeedbackItem[]>(
      `/console/feedback${query({
        usuarioId: params.usuarioId || undefined,
        status: params.status === '' || params.status === undefined ? undefined : params.status,
        from: params.from,
        to: params.to,
        modulo: params.modulo || undefined,
        nota: params.nota === '' || params.nota === undefined ? undefined : params.nota,
        take: params.take ?? 200,
      })}`,
    ),
  listConsoleUsuarios: () => apiFetch<ConsoleFeedbackUsuarioOption[]>('/console/feedback/usuarios'),
  getConsole: (id: string) => apiFetch<ConsoleFeedbackItem>(`/console/feedback/${id}`),
  replyConsole: (id: string, resposta: string) =>
    apiFetch<ConsoleFeedbackItem>(`/console/feedback/${id}/resposta`, json('PUT', { resposta })),
}
