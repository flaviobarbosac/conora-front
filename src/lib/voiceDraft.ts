const KEY = 'conora.voiceDraft'

export type VoiceDraft = {
  description: string
  amount: string
}

export function setVoiceDraft(draft: VoiceDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft))
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

/** @deprecated Prefer beginVoiceListen for UI with confirm. */
export function listenVoiceDraft(): Promise<VoiceDraft> {
  const handle = beginVoiceListen({ maxMs: 8_000 })
  return handle.promise.finally(() => {
    /* auto-stop after short window when used without UI */
  })
}
