import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiApi } from '../api/finance'
import { errorMessage, currentCompetence } from '../lib/format'
import { ianReportHref } from '../lib/ianReport'
import { IAN_VOICES, getIanVoice, setIanVoice, speakPt, stopSpeaking, type IanVoiceId } from '../lib/speakPt'
import { commitVoiceEntry, prefetchVoiceCatalog } from '../lib/voiceEntry'
import {
  absorb,
  emptyEntry,
  fromDraft,
  looksLikeEntry,
  looksLikeNavigation,
  missingPrompt,
  missingSlots,
  toDraft,
  type SpokenEntry,
} from '../lib/voiceInterview'
import { isVoiceRoute } from '../lib/voiceRoutes'
import { beginVoiceSession, clearVoiceDraft, clearVoiceFill, isCancelPhrase, publishVoiceFill, setVoiceDraft, speechRecognitionAvailable, type VoiceSessionHandle } from '../lib/voiceDraft'
import { startVoiceVisualizer } from '../lib/voiceVisualizer'
import { VoiceOscillator } from './VoiceOscillator'
import styles from './IanFloatingChat.module.css'

function faceSrc(id: IanVoiceId): string {
  const file = id === 'clara' ? 'ian-menina.jpg' : 'ian-garoto.jpg'
  return `${import.meta.env.BASE_URL}assets/${file}`
}

export function IanFloatingChat() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [active, setActive] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [voiceId, setVoiceId] = useState<IanVoiceId>(() => getIanVoice().id)
  const [modStatus, setModStatus] = useState<'Lendo dados' | 'registrando' | 'aguarde' | null>(null)
  const setModStatusRef = useRef(setModStatus)
  setModStatusRef.current = setModStatus
  const levelsRef = useRef<number[]>(Array.from({ length: 16 }, () => 0.12))
  const sessionRef = useRef<VoiceSessionHandle | null>(null)
  const stopVisualizer = useRef<(() => void) | null>(null)
  const pendingRef = useRef<SpokenEntry | null>(null)
  const entryEpoch = useRef(0)
  const activeRef = useRef(false)
  const micOnRef = useRef(false)
  const openListeningRef = useRef<() => void>(() => undefined)
  const speechOk = speechRecognitionAvailable()

  useEffect(() => {
    setAnchor(document.getElementById('conora-voice-center'))
  }, [pathname])

  useEffect(() => {
    const open = () => openListeningRef.current()
    window.addEventListener('conora:open-voice', open)
    return () => window.removeEventListener('conora:open-voice', open)
  }, [])

  useEffect(() => {
    return () => {
      activeRef.current = false
      sessionRef.current?.cancel()
      stopVisualizer.current?.()
      stopSpeaking()
    }
  }, [])

  function stopVisualizerNow() {
    stopVisualizer.current?.()
    stopVisualizer.current = null
  }

  function stopSession() {
    activeRef.current = false
    micOnRef.current = false
    setActive(false)
    setChoosing(false)
    pendingRef.current = null
    sessionRef.current?.cancel()
    sessionRef.current = null
    setModStatusRef.current(null)
    stopVisualizerNow()
    stopSpeaking()
  }

  function ensureSession() {
    if (sessionRef.current) {
      return
    }
    sessionRef.current = beginVoiceSession({
      onActivity: () => setModStatusRef.current('Lendo dados'),
      onPhrase: (phrase) => {
        sessionRef.current?.pause()
        void (async () => {
          try {
            await handleUtterance(phrase)
          } catch (caught: unknown) {
            await say(errorMessage(caught))
          } finally {
            if (activeRef.current && micOnRef.current) {
              setModStatusRef.current(null)
              sessionRef.current?.resume()
            }
          }
        })()
      },
      onError: (message) => {
        stopSession()
        void speakPt(message)
      },
    })
  }

  function startMic() {
    if (!speechOk) {
      void speakPt('Este navegador não liberou o microfone.')
      return
    }
    stopSpeaking()
    micOnRef.current = true
    stopVisualizerNow()
    stopVisualizer.current = startVoiceVisualizer((levels) => {
      levelsRef.current = levels
    })
    ensureSession()
    sessionRef.current?.resume()
  }

  async function say(text: string) {
    if (!activeRef.current || !text.trim()) {
      return
    }
    setModStatusRef.current('aguarde')
    await speakPt(text)
  }

  function dropEntry() {
    entryEpoch.current += 1
    pendingRef.current = null
    clearVoiceDraft()
    clearVoiceFill()
  }

  function reveal(entry: SpokenEntry) {
    publishVoiceFill({
      type: entry.type,
      amount: entry.amount,
      date: entry.date,
      description: entry.description,
      categoryName: entry.categoryName,
      accountName: entry.accountName,
    })
    if (!window.location.pathname.includes('/lancamentos')) {
      navigate('/lancamentos?novo=1')
      return
    }
    window.dispatchEvent(new Event('conora:voice-open-form'))
  }

  async function finishEntry(entry: SpokenEntry) {
    const slots = missingSlots(entry)
    if (slots.length > 0) {
      entry.asked = slots[0]
      pendingRef.current = entry
      reveal(entry)
      await say(missingPrompt(entry))
      return
    }
    entry.asked = null
    pendingRef.current = entry
    reveal(entry)
    await commitPending(entry)
  }

  async function commitPending(entry: SpokenEntry) {
    const epoch = entryEpoch.current
    const result = await commitVoiceEntry(toDraft(entry), () => setModStatusRef.current('registrando'))
    if (epoch !== entryEpoch.current || !activeRef.current) {
      return
    }
    pendingRef.current = null
    if (result.status === 'rejected') {
      for (const field of result.clear) {
        entry[field] = null
      }
      entry.asked = result.clear[0] ?? null
      pendingRef.current = entry
      reveal(entry)
      await say(result.message)
      return
    }
    if (result.status === 'saved') {
      clearVoiceFill()
      window.dispatchEvent(new CustomEvent('conora:voice-saved', { detail: { id: result.id } }))
      await say('Gravei.')
      return
    }
    if (result.status === 'needs-form') {
      setVoiceDraft({ description: result.description, amount: result.amount })
      await say('Falta a conta bancária. Revise o lançamento e salve.')
      navigate('/lancamentos?novo=1&voz=1')
      return
    }
    await say(result.message)
  }

  async function handleUtterance(text: string) {
    const spoken = text.trim()
    if (!spoken || !activeRef.current) {
      return
    }
    setModStatusRef.current('Lendo dados')

    if (isCancelPhrase(spoken)) {
      dropEntry()
      await say('Lançamento cancelado.')
      stopSession()
      return
    }
    if (pendingRef.current && !looksLikeNavigation(spoken)) {
      const next = absorb(pendingRef.current, spoken)
      pendingRef.current = next
      await finishEntry(next)
      return
    }
    if (!looksLikeNavigation(spoken) && looksLikeEntry(spoken)) {
      await finishEntry(absorb(emptyEntry(), spoken))
      return
    }
    pendingRef.current = null

    const command = await aiApi.voice(spoken, currentCompetence())
    if (!activeRef.current) {
      return
    }
    if (command.intent === 'navigate' && isVoiceRoute(command.route)) {
      navigate(command.route)
      await say(command.reply || 'Abrindo a tela.')
      return
    }
    if (command.intent === 'action' && command.action === 'create-entry' && command.entry) {
      const next = absorb(fromDraft(command.entry), spoken)
      await finishEntry(next)
      return
    }
    if (command.intent === 'report' && command.report) {
      navigate(ianReportHref(command.report))
    }
    await say(command.reply || 'Não consegui responder agora.')
  }

  function greetAndListen(next: IanVoiceId) {
    const label = IAN_VOICES.find((voice) => voice.id === next)?.label ?? 'Ian'
    sessionRef.current?.pause()
    stopSpeaking()
    void speakPt(`Olá, eu sou ${label}.`, next).finally(() => {
      if (activeRef.current) {
        startMic()
      }
    })
  }

  function openListening() {
    if (activeRef.current && micOnRef.current) {
      return
    }
    activeRef.current = true
    setActive(true)
    setChoosing(false)
    prefetchVoiceCatalog()
    startMic()
  }
  openListeningRef.current = openListening

  function selectVoice(next: IanVoiceId) {
    setChoosing(false)
    if (next === voiceId) {
      return
    }
    setVoiceId(next)
    setIanVoice(next)
    const label = IAN_VOICES.find((voice) => voice.id === next)?.label ?? 'Ian'
    if (activeRef.current) {
      greetAndListen(next)
      return
    }
    void speakPt(`Olá, eu sou ${label}.`, next)
  }

  if (!anchor) {
    return null
  }

  return createPortal(
    <div className={active ? styles.dockOpen : styles.dock}>
      <button
        type="button"
        className={styles.voiceChoose}
        aria-label="Escolher voz"
        aria-expanded={choosing}
        onClick={() => setChoosing((open) => !open)}
      >
        Voz
      </button>
      {choosing ? (
        <div className={styles.bar} role="group" aria-label="Voz">
          <button
            type="button"
            className={voiceId === 'ian' ? styles.pickOn : styles.pick}
            aria-label="Ian"
            aria-pressed={voiceId === 'ian'}
            onClick={() => selectVoice('ian')}
          >
            <img className={styles.agentFace} src={faceSrc('ian')} alt="" />
          </button>
          <button
            type="button"
            className={voiceId === 'clara' ? styles.pickOn : styles.pick}
            aria-label="Clara"
            aria-pressed={voiceId === 'clara'}
            onClick={() => selectVoice('clara')}
          >
            <img className={styles.agentFace} src={faceSrc('clara')} alt="" />
          </button>
        </div>
      ) : null}
      {active ? (
        <button type="button" className={styles.close} aria-label="Fechar" onClick={stopSession}>
          ×
        </button>
      ) : null}
      <button
        type="button"
        className={active ? styles.agentOn : styles.agent}
        aria-label="Falar com o Ian"
        aria-pressed={active}
        onClick={openListening}
      >
        <img className={styles.agentFace} src={faceSrc(voiceId)} alt="" />
        {active ? (
          <span className={styles.agentMod}>
            {modStatus ? <span className={styles.modStatus}>{modStatus}</span> : null}
            <VoiceOscillator levelsRef={levelsRef} compact tone="cursor" />
          </span>
        ) : null}
      </button>
    </div>,
    anchor,
  )
}
