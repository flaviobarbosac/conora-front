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

/** Portrait ages of the maturity journey, in order. 0 is the baby. */
export const IAN_AGES = [0, 5, 8, 10, 12, 15, 18, 22, 30] as const

export type IanAge = (typeof IAN_AGES)[number]

/** Voice bands: the voice changes less often than the portrait. */
export type IanVoiceBand = 'child' | 'preteen' | 'teen' | 'adult'

export const IAN_MATURITY_CHANGED = 'conora.ianMaturity'

const BAND_PITCH: Record<IanVoiceBand, number> = { child: 1.5, preteen: 1.3, teen: 1.12, adult: 1 }

let maturityAge: IanAge | null = null

export function voiceBandForAge(age: IanAge | null): IanVoiceBand {
  if (age === null) {
    return 'adult'
  }
  if (age <= 5) {
    return 'child'
  }
  if (age <= 12) {
    return 'preteen'
  }
  return age <= 18 ? 'teen' : 'adult'
}

/**
 * Sets the age shown by the portrait and heard in the voice.
 * Null (journey unknown) or quiet mode keeps the adult voice and the default portrait,
 * so quiet mode never reveals the age through the voice.
 */
export function setIanMaturity(age: IanAge | null, quiet = false): void {
  const next = quiet ? null : age
  if (next === maturityAge) {
    return
  }
  maturityAge = next
  window.dispatchEvent(new Event(IAN_MATURITY_CHANGED))
}

export function getIanAge(): IanAge | null {
  return maturityAge
}

/** Portrait for the current maturity. Unknown age uses the original jpg; every milestone age has its own png. */
export function ianPortrait(id: IanVoiceId): string {
  const base = id === 'clara' ? 'ian-menina' : 'ian-garoto'
  const file =
    maturityAge === null ? `${base}.jpg` : `${base}-${String(maturityAge).padStart(2, '0')}.png`
  return `${import.meta.env.BASE_URL}assets/${file}`
}

/**
 * Applies the settings toggle and the milestone age to portrait and voice.
 * Evolution off always pins age 30 (adult voice). Quiet mode still hides age.
 */
export function applyIanMaturity(age: IanAge | null, options?: { quiet?: boolean; photoEvolutionEnabled?: boolean }): void {
  const evolutionOn = options?.photoEvolutionEnabled !== false
  const quiet = options?.quiet === true
  if (quiet) {
    setIanMaturity(null, true)
    return
  }
  if (!evolutionOn) {
    setIanMaturity(30)
    return
  }
  setIanMaturity(age)
}

/** Highest earned milestone age in order (no skip). Baby (0) when none earned yet. */
export function maturityAgeFromAchievements(
  items: ReadonlyArray<{ key: string; earned: boolean }>,
): IanAge {
  const earned = new Set(items.filter((item) => item.earned).map((item) => item.key))
  const order: ReadonlyArray<{ key: string; age: IanAge }> = [
    { key: 'budget-half-filled', age: 8 },
    { key: 'first-budget', age: 8 },
    { key: 'first-month-closed', age: 10 },
    { key: 'three-months-in-budget', age: 12 },
    { key: 'payment-on-time', age: 15 },
    { key: 'budget-on-time', age: 15 },
    { key: 'reserve-started', age: 18 },
    { key: 'has-reserve', age: 18 },
    { key: 'reserve-complete', age: 22 },
    { key: 'project-progress', age: 30 },
  ]
  const ages = [8, 10, 12, 15, 18, 22, 30] as const
  const hasAge = (age: number) =>
    order.some((item) => item.age === age && earned.has(item.key))
  let current: IanAge = 0
  for (const age of ages) {
    if (!hasAge(age)) {
      break
    }
    current = age
  }
  return current
}

const FEMALE_HINT =/maria|francisca|luciana|heloisa|leticia|female|feminina|vitoria|vitória/
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

/** At age 30 the spoken line stays short and drops tutorial padding. */
function speakTextForMaturity(text: string): string {
  if (maturityAge !== 30) {
    return text
  }
  const first = text.split(/(?<=[.!?…])\s+/)[0]?.trim() || text.trim()
  return first.length > 160 ? `${first.slice(0, 157)}…` : first
}

async function speakHuman(text: string, voiceId: IanVoiceId, signal: AbortSignal): Promise<boolean> {
  const band = voiceBandForAge(maturityAge)
  const blob = await apiPostBlob('/ai/speak', { text: speakTextForMaturity(text), voice: voiceId, band }, signal)
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
        utter.pitch = BAND_PITCH[voiceBandForAge(maturityAge)]
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
