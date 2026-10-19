import { apiPostBlob } from '../api/client'

const STORAGE_KEY = 'conora.ianVoice'

export type IanVoiceId = 'ian' | 'clara'

export type IanVoice = {
  id: IanVoiceId
  label: string
  pitch: number
  rate: number
}

export const IAN_VOICES: readonly IanVoice[] = [
  { id: 'ian', label: 'Ian', pitch: 1, rate: 1 },
  { id: 'clara', label: 'Clara', pitch: 1, rate: 1 },
]

const FEMALE_HINT = /maria|francisca|luciana|heloisa|leticia|female|feminina|vitoria|vitória/
const MALE_HINT = /daniel|antonio|antônio|male|masculin|david|mark|guy|james/

export function getIanVoice(): IanVoice {
  const stored = localStorage.getItem(STORAGE_KEY)
  return IAN_VOICES.find((voice) => voice.id === stored) ?? IAN_VOICES[0]
}

export function setIanVoice(id: IanVoiceId): void {
  localStorage.setItem(STORAGE_KEY, id)
}

function voiceScore(voice: SpeechSynthesisVoice, id: IanVoiceId): number {
  const name = voice.name.toLowerCase()
  const lang = voice.lang.toLowerCase().replace('_', '-')
  const hint = id === 'clara' ? FEMALE_HINT : MALE_HINT
  if (!lang.startsWith('pt') || !hint.test(name)) {
    return -1
  }
  let score = lang.startsWith('pt-br') ? 100 : 40
  if (/natural|neural|online/.test(name)) {
    score += 80
  }
  return score
}

function systemVoice(synth: SpeechSynthesis, id: IanVoiceId): SpeechSynthesisVoice | null {
  const ranked = synth
    .getVoices()
    .map((voice) => ({ voice, score: voiceScore(voice, id) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
  return ranked[0]?.voice ?? null
}

function voiceFor(synth: SpeechSynthesis, id: IanVoiceId): SpeechSynthesisVoice | null {
  return systemVoice(synth, id)
}

let clip: HTMLAudioElement | null = null
let releaseClip: (() => void) | null = null
let speakAbort: AbortController | null = null
let speakGen = 0

function stopClip() {
  const release = releaseClip
  releaseClip = null
  const audio = clip
  clip = null
  if (audio) {
    audio.onended = null
    audio.onerror = null
    audio.pause()
    const url = audio.src
    audio.src = ''
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }
  release?.()
}

function playClip(blob: Blob): Promise<void> {
  stopClip()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  clip = audio
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) {
        return
      }
      settled = true
      if (releaseClip === done) {
        releaseClip = null
      }
      if (clip === audio) {
        clip = null
        audio.pause()
        audio.src = ''
        URL.revokeObjectURL(url)
      }
      resolve()
    }
    releaseClip = done
    audio.onended = done
    audio.onerror = done
    void audio.play().catch(done)
  })
}

async function speakHuman(text: string, voiceId: IanVoiceId, signal: AbortSignal): Promise<boolean> {
  const blob = await apiPostBlob('/ai/speak', { text, voice: voiceId }, signal)
  if (signal.aborted || !blob || blob.size < 64) {
    return false
  }
  await playClip(blob)
  return true
}

function speakBrowser(text: string, voiceId: IanVoiceId, gen: number): Promise<void> {
  if (typeof window.speechSynthesis === 'undefined') {
    return Promise.resolve()
  }

  const synth = window.speechSynthesis
  return new Promise((resolve) => {
    let started = false
    const start = () => {
      if (started) {
        return
      }
      started = true
      synth.cancel()
      window.setTimeout(() => {
        if (gen !== speakGen) {
          resolve()
          return
        }
        const utter = new SpeechSynthesisUtterance(text)
        const voice = voiceFor(synth, voiceId)
        utter.lang = voice?.lang || 'pt-BR'
        if (voice) {
          utter.voice = voice
        }
        const natural = Boolean(voice && /natural|neural|online/i.test(voice.name))
        utter.pitch = 1
        utter.rate = natural ? 0.98 : 0.88
        utter.onend = () => resolve()
        utter.onerror = () => resolve()
        synth.speak(utter)
      }, 80)
    }

    if (synth.getVoices().length > 0) {
      start()
      return
    }

    const timer = window.setTimeout(start, 400)
    synth.addEventListener(
      'voiceschanged',
      () => {
        window.clearTimeout(timer)
        start()
      },
      { once: true },
    )
  })
}

/** Reads a reply aloud. Prefers the Gemini voice and falls back to the browser. */
export async function speakPt(text: string, voiceId?: IanVoiceId): Promise<void> {
  const spoken = text.replace(/\s+/g, ' ').trim()
  if (!spoken) {
    return
  }

  const profile = IAN_VOICES.find((voice) => voice.id === voiceId) ?? getIanVoice()
  const gen = ++speakGen
  speakAbort?.abort()
  const abort = new AbortController()
  speakAbort = abort
  stopClip()
  window.speechSynthesis?.cancel()
  try {
    if (await speakHuman(spoken, profile.id, abort.signal)) {
      return
    }
  } catch {
    /* browser voice below, unless this turn was cut off */
  }
  if (gen !== speakGen || abort.signal.aborted) {
    return
  }
  await speakBrowser(spoken, profile.id, gen)
}

/** Stops the current reply at once, including a chunk that is still playing. */
export function stopSpeaking(): void {
  speakGen += 1
  speakAbort?.abort()
  speakAbort = null
  stopClip()
  window.speechSynthesis?.cancel()
}
