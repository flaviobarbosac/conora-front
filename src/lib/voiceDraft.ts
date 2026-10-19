const KEY = 'conora.voiceDraft'

export type VoiceDraft = {
  description: string
  amount: string
}

export type VoiceFill = {
  type: 'Expense' | 'Income' | null
  amount: number | null
  date: string | null
  description: string | null
  categoryName: string | null
  accountName: string | null
}

let currentFill: VoiceFill | null = null
const fillListeners = new Set<(fill: VoiceFill) => void>()

export function publishVoiceFill(fill: VoiceFill): void {
  currentFill = fill
  for (const listener of fillListeners) {
    listener(fill)
  }
  window.dispatchEvent(new CustomEvent('conora:voice-fill'))
}

export function subscribeVoiceFill(listener: (fill: VoiceFill) => void): () => void {
  fillListeners.add(listener)
  if (currentFill) {
    listener(currentFill)
  }
  return () => fillListeners.delete(listener)
}

export function clearVoiceFill(): void {
  currentFill = null
}

export function setVoiceDraft(draft: VoiceDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft))
}

export function clearVoiceDraft(): void {
  sessionStorage.removeItem(KEY)
}

/** True when the speaker told the guided entry to stop. */
export function isCancelPhrase(text: string): boolean {
  const spoken = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /\bcancela/.test(spoken) || spoken === 'nao'
}

export function takeVoiceDraft(): VoiceDraft | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) {
    return null
  }
  sessionStorage.removeItem(KEY)
  try {
    const parsed = JSON.parse(raw) as VoiceDraft
    if (typeof parsed.description !== 'string') {
      return null
    }
    return {
      description: parsed.description,
      amount: typeof parsed.amount === 'string' ? parsed.amount : '',
    }
  } catch {
    return null
  }
}

type SpeechRecognitionResultLike = {
  isFinal?: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike> & { length: number }
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

export function speechRecognitionAvailable(): boolean {
  const w = window as SpeechWindow
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/** Pulls the first money-like number from spoken Portuguese/English text. */
export function amountFromTranscript(transcript: string): string {
  const normalized = transcript
    .toLowerCase()
    .replace(/\s+reais?\b/g, '')
    .replace(/\s+real\b/g, '')
  const match = normalized.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (!match) {
    return ''
  }
  const raw = match[1].replace(/\./g, '').replace(',', '.')
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }
  return value.toFixed(2).replace('.', ',')
}

export type VoiceListenHandle = {
  confirm: () => void
  cancel: () => void
  promise: Promise<VoiceDraft>
}

const DEFAULT_VOICE_MAX_MS = 30_000

/**
 * Starts listening until confirm(), cancel(), or maxMs (default 30s).
 * confirm() / timeout resolves with what was heard; cancel() rejects.
 */
export function beginVoiceListen(options?: {
  maxMs?: number
  onTranscript?: (text: string) => void
}): VoiceListenHandle {
  const w = window as SpeechWindow
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) {
    return {
      confirm: () => undefined,
      cancel: () => undefined,
      promise: Promise.reject(new Error('Este navegador não liberou o microfone para ditado.')),
    }
  }

  let settled = false
  let finalText = ''
  let interimText = ''
  let recognition: SpeechRecognitionLike | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const currentText = () => (finalText + (interimText ? ` ${interimText}` : '')).trim()

  let resolveDraft: (draft: VoiceDraft) => void = () => undefined
  let rejectDraft: (error: Error) => void = () => undefined

  const promise = new Promise<VoiceDraft>((resolve, reject) => {
    resolveDraft = resolve
    rejectDraft = reject
  })

  function cleanup() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function settleOk() {
    if (settled) {
      return
    }
    settled = true
    cleanup()
    const transcript = currentText()
    try {
      recognition?.stop()
    } catch {
      /* already stopped */
    }
    if (!transcript) {
      rejectDraft(new Error('Nenhuma fala detectada. Tente de novo.'))
      return
    }
    resolveDraft({
      description: transcript,
      amount: amountFromTranscript(transcript),
    })
  }

  function settleErr(error: Error) {
    if (settled) {
      return
    }
    settled = true
    cleanup()
    try {
      recognition?.abort()
    } catch {
      /* ignore */
    }
    rejectDraft(error)
  }

  recognition = new Ctor()
  recognition.lang = 'pt-BR'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let interim = ''
    let finals = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i]
      const text = piece?.[0]?.transcript?.trim() ?? ''
      if (!text) {
        continue
      }
      if (piece.isFinal) {
        finals += (finals ? ' ' : '') + text
      } else {
        interim += (interim ? ' ' : '') + text
      }
    }
    if (finals) {
      finalText = `${finalText} ${finals}`.trim()
    }
    interimText = interim
    options?.onTranscript?.(currentText())
  }

  recognition.onerror = (event) => {
    if (event.error === 'aborted') {
      return
    }
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      settleErr(new Error('Permita o microfone para lançar por voz.'))
      return
    }
    if (event.error === 'no-speech') {
      // keep listening until confirm / timeout
      return
    }
    settleErr(new Error('Não foi possível usar o microfone.'))
  }

  recognition.onend = () => {
    if (settled) {
      return
    }
    // browser may pause; restart while still open
    try {
      recognition?.start()
    } catch {
      settleOk()
    }
  }

  try {
    recognition.start()
  } catch {
    settleErr(new Error('Não foi possível iniciar o ditado.'))
  }

  const maxMs = options?.maxMs ?? DEFAULT_VOICE_MAX_MS
  timer = setTimeout(() => settleOk(), maxMs)

  return {
    promise,
    confirm: () => settleOk(),
    cancel: () => settleErr(new Error('Ditado cancelado.')),
  }
}

export type VoiceSessionHandle = {
  pause: () => void
  resume: () => void
  /** Keeps the mic open over playback so the user can cut the reply off. */
  armBarge: (echo: string) => void
  cancel: () => void
}

/** Silence that ends a user turn. Short, but long enough for a breath mid-sentence. */
export const END_OF_SPEECH_MS = 1300

function foldSpeech(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isEcho(live: string, spoken: string): boolean {
  const heard = foldSpeech(live)
  const reply = foldSpeech(spoken)
  if (!heard || !reply) {
    return true
  }
  if (reply.includes(heard) || heard.includes(reply)) {
    return true
  }
  const replyWords = new Set(reply.split(' ').filter((word) => word.length > 1))
  const novel = heard.split(' ').filter((word) => word.length > 1 && !replyWords.has(word))
  return novel.length === 0
}

function withoutEcho(live: string, spoken: string): string {
  const replyWords = new Set(foldSpeech(spoken).split(' ').filter(Boolean))
  return live
    .split(/\s+/)
    .filter((word) => !replyWords.has(foldSpeech(word)))
    .join(' ')
    .trim()
}

/**
 * Keeps the mic open and emits each finished phrase. Home dictation stays on beginVoiceListen.
 * pause() while a phrase is handled. armBarge() listens over the reply and cuts it off.
 */
export function beginVoiceSession(options: {
  onPhrase: (text: string) => void
  onActivity?: () => void
  onBarge?: () => void
  onError?: (message: string) => void
  gapMs?: number
}): VoiceSessionHandle {
  const w = window as SpeechWindow
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) {
    options.onError?.('Este navegador não liberou o microfone para ditado.')
    return { pause: () => undefined, resume: () => undefined, armBarge: () => undefined, cancel: () => undefined }
  }

  let stopped = false
  let paused = false
  let listening = false
  let echo = ''
  let barged = false
  let buffer = ''
  let interim = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  const gapMs = options.gapMs ?? END_OF_SPEECH_MS
  const recognition = new Ctor()
  recognition.lang = 'pt-BR'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function emit() {
    const phrase = `${buffer} ${interim}`.trim()
    buffer = ''
    interim = ''
    clearTimer()
    if (!phrase || stopped || paused) {
      return
    }
    options.onPhrase(phrase)
  }

  function arm() {
    clearTimer()
    timer = setTimeout(emit, gapMs)
  }

  function startRecognition() {
    if (stopped) {
      return
    }
    try {
      recognition.start()
    } catch {
      /* start races with onend */
    }
  }

  recognition.onresult = (event) => {
    if (stopped || !listening || (paused && !echo)) {
      return
    }
    let finals = ''
    let nextInterim = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i]
      const text = piece?.[0]?.transcript?.trim() ?? ''
      if (!text) {
        continue
      }
      if (piece.isFinal) {
        finals += (finals ? ' ' : '') + text
      } else {
        nextInterim += (nextInterim ? ' ' : '') + text
      }
    }
    if (finals) {
      buffer = `${buffer} ${finals}`.trim()
    }
    interim = nextInterim
    const live = `${buffer} ${interim}`.trim()
    if (echo) {
      if (!live || isEcho(live, echo)) {
        buffer = ''
        interim = ''
        clearTimer()
        return
      }
      if (!barged) {
        barged = true
        options.onBarge?.()
      }
      buffer = withoutEcho(live, echo)
      interim = ''
      if (!buffer) {
        clearTimer()
        return
      }
      options.onActivity?.()
      arm()
      return
    }
    if (live && isCancelPhrase(live)) {
      emit()
      return
    }
    if (buffer || interim) {
      options.onActivity?.()
      arm()
    }
  }

  recognition.onerror = (event) => {
    if (stopped || event.error === 'aborted' || event.error === 'no-speech') {
      return
    }
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopped = true
      options.onError?.('Permita o microfone para falar com o Ian.')
      return
    }
    stopped = true
    options.onError?.('Não foi possível usar o microfone.')
  }

  recognition.onend = () => {
    if (stopped || (paused && !echo)) {
      return
    }
    const pending = `${buffer} ${interim}`.trim()
    if (pending) {
      buffer = pending
      interim = ''
      emit()
      return
    }
    startRecognition()
  }

  listening = true
  try {
    recognition.start()
  } catch {
    stopped = true
    listening = false
    options.onError?.('Não foi possível iniciar o ditado.')
  }

  return {
    pause: () => {
      paused = true
      listening = false
      echo = ''
      barged = false
      clearTimer()
      try {
        recognition.abort()
      } catch {
        /* already stopped */
      }
    },
    resume: () => {
      if (stopped || !paused) {
        return
      }
      paused = false
      listening = true
      echo = ''
      barged = false
      buffer = ''
      interim = ''
      window.setTimeout(() => {
        if (stopped || paused) {
          return
        }
        startRecognition()
      }, 80)
    },
    armBarge: (spoken: string) => {
      if (stopped) {
        return
      }
      echo = spoken
      barged = false
      paused = false
      listening = true
      buffer = ''
      interim = ''
      clearTimer()
      startRecognition()
    },
    cancel: () => {
      stopped = true
      paused = true
      clearTimer()
      try {
        recognition.abort()
      } catch {
        /* ignore */
      }
    },
  }
}

/** @deprecated Prefer beginVoiceListen for UI with confirm. */
export function listenVoiceDraft(): Promise<VoiceDraft> {
  const handle = beginVoiceListen({ maxMs: 8_000 })
  return handle.promise.finally(() => {
    /* auto-stop after short window when used without UI */
  })
}
