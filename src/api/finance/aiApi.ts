import { apiFetch } from '../client'
import { json } from './helpers'
import type {
  AiAnswer,
  VoiceCommand,
  VoiceTurn,
} from './types'
export const aiApi = {
  ask: (question: string, competenceYm?: string) =>
    apiFetch<AiAnswer>('/ai/ask', json('POST', { question, competenceYm })),
  voice: (transcript: string, competenceYm?: string, history?: VoiceTurn[]) =>
    apiFetch<VoiceCommand>('/ai/voice', json('POST', { transcript, competenceYm, history: history ?? [] })),
  voiceUser: () => apiFetch<{ name: string; firstName: string }>('/ai/voice/user'),
  suggestCategories: (term: string, type?: string) =>
    apiFetch<{ names: string[] }>('/ai/voice/categories', json('POST', { term, type })),
}
