import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiApi, familyApi, type VoiceTurn } from '../api/finance'
import { errorMessage, currentCompetence, dateToApi, formatDate, formatMoney } from '../lib/format'
import {
  IAN_MATURITY_CHANGED,
  IAN_VOICES,
  getIanVoice,
  ianPortrait,
  setIanVoice,
  speakPt,
  stopSpeaking,
  type IanVoiceId,
} from '../lib/speakPt'
import { commitVoiceEntry, fillAporteCategory, prefetchVoiceCatalog, resolveSpokenDate, unknownCategoryMessage, unknownProjectMessage } from '../lib/voiceEntry'
import {
  absorb,
  emptyBudget,
  emptyEntry,
  looksLikeBudget,
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

function foldPhrase(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isYesPhrase(text: string): boolean {
  const spoken = foldPhrase(text)
  return ['sim', 'confirma', 'confirmo', 'confirmado', 'pode', 'isso', 'ok', 'ta', 'certo', 'pode ser', 'sim confirma', 'sim pode'].includes(spoken)
}

function isApprovePhrase(text: string): boolean {
  const spoken = foldPhrase(text)
  return isYesPhrase(text) || spoken === 'aprovo' || spoken === 'aprovado' || spoken === 'pode lancar' || spoken === 'pode gravar'
}

function reviewSpeech(entry: SpokenEntry): string {
  const kind = entry.type === 'Income' ? 'receita' : 'despesa'
  const when = formatDate(dateToApi(resolveSpokenDate(entry.date)))
  const value = entry.amount == null ? '' : formatMoney(entry.amount)
  return `O que você me pediu para lançar é isto: ${kind}, ${value}, ${entry.description}, categoria ${entry.categoryName}, conta ${entry.accountName}, data ${when}. Você aprova o lançamento?`
}

function isNoPhrase(text: string): boolean {
  const spoken = foldPhrase(text)
  return ['nao', 'negativo', 'outra', 'outro', 'errei', 'errado', 'volta', 'nenhuma', 'nenhum'].includes(spoken)
}

function isDonePhrase(text: string): boolean {
  const spoken = foldPhrase(text)
  return [
    'nao',
    'nada',
    'nada mais',
    'nao precisa',
    'nao obrigado',
    'nao obrigada',
    'obrigado',
    'obrigada',
    'valeu',
    'era so',
    'era so isso',
    'so isso',
    'somente isso',
    'pode parar',
    'pode encerrar',
    'podemos encerrar',
    'podemos encerrar por aqui',
    'encerrar por aqui',
    'encerra',
    'encerrar',
    'fecha',
    'pode fechar',
    'tchau',
    'dispenso',
    'por enquanto nao',
    'pronto',
  ].includes(spoken)
}

function matchCategoryOption(spoken: string, names: string[]): string | null {
  const needle = foldPhrase(spoken)
  if (!needle) {
    return null
  }
  const exact = names.filter((name) => foldPhrase(name) === needle)
  if (exact.length === 1) {
    return exact[0]
  }
  const partial = names.filter((name) => {
    const folded = foldPhrase(name)
    return folded.includes(needle) || needle.includes(folded)
  })
  return partial.length === 1 ? partial[0] : null
}

/** When false, Ian voice listen / mic stays in code but is unreachable on web, iOS, and Android. */
const IAN_MIC_ENABLED = false

/** Voice UI removed from the product surface (plan MVP 14/11). Keep the module for a later revive. */
export function IanFloatingChat() {
  return null
}

function IanFloatingChatDisabled() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [active, setActive] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [voiceId, setVoiceId] = useState<IanVoiceId>(() => getIanVoice().id)
  const [, setMaturityTick] = useState(0)
  const [modStatus, setModStatus] = useState<'Lendo dados' | 'registrando' | 'aguarde' | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [categoryChoice, setCategoryChoice] = useState<string | null>(null)
  const [categoryBox, setCategoryBox] = useState<{ left: number; top: number } | null>(null)
  const categoryPopRef = useRef<HTMLDivElement>(null)
  const categoryOptionsRef = useRef<string[]>([])
  const categoryChoiceRef = useRef<string | null>(null)
  const setModStatusRef = useRef(setModStatus)
  setModStatusRef.current = setModStatus
  const levelsRef = useRef<number[]>(Array.from({ length: 16 }, () => 0.12))
  const sessionRef = useRef<VoiceSessionHandle | null>(null)
  const stopVisualizer = useRef<(() => void) | null>(null)
  const pendingRef = useRef<SpokenEntry | null>(null)
  const reviewRef = useRef<SpokenEntry | null>(null)
  const confirmRef = useRef(true)
  const [review, setReview] = useState<SpokenEntry | null>(null)
  const followUpRef = useRef(false)
  const idleTimer = useRef<number | null>(null)
  const idleAsked = useRef(false)
  const optionSlotRef = useRef<'categoryName' | 'projectName'>('categoryName')
  const [optionTitle, setOptionTitle] = useState('Encontrei essas categorias')
  const historyRef = useRef<VoiceTurn[]>([])
  const turnGen = useRef(0)
  const entryEpoch = useRef(0)
  const activeRef = useRef(false)
  const micOnRef = useRef(false)
  const openListeningRef = useRef<() => void>(() => undefined)
  const speechOk = speechRecognitionAvailable()
  const spokenNameRef = useRef('')

  useEffect(() => {
    void aiApi.voiceUser()
      .then((user) => {
        spokenNameRef.current = user.firstName?.trim() || ''
      })
      .catch(() => undefined)
    void familyApi.profile()
      .then((profile) => {
        confirmRef.current = profile.voiceEntryConfirm !== false
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const refresh = () => setMaturityTick((tick) => tick + 1)
    window.addEventListener(IAN_MATURITY_CHANGED, refresh)
    return () => window.removeEventListener(IAN_MATURITY_CHANGED, refresh)
  }, [])

  function withName(text: string): string {
    const name = spokenNameRef.current
    const line = text.trim()
    if (!name || !line || line.toLowerCase().includes(name.toLowerCase())) {
      return line
    }
    return `${name}, ${line}`
  }

  useEffect(() => {
    setAnchor(document.getElementById('conora-voice-center') ?? document.getElementById('conora-voice-header'))
  }, [pathname])

  useEffect(() => {
    if (!anchor || categoryOptions.length === 0) {
      setCategoryBox(null)
      return
    }
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const pop = categoryPopRef.current
      const halfW = (pop?.offsetWidth ?? 288) / 2
      const halfH = (pop?.offsetHeight ?? 240) / 2
      const margin = 8
      const rawLeft = rect.left + rect.width / 2
      const rawTop = rect.top + rect.height / 2
      const left = Math.min(window.innerWidth - halfW - margin, Math.max(halfW + margin, rawLeft))
      const top = Math.min(window.innerHeight - halfH - margin, Math.max(halfH + margin, rawTop))
      setCategoryBox((current) =>
        current && Math.abs(current.left - left) < 1 && Math.abs(current.top - top) < 1
          ? current
          : { left, top },
      )
    }
    place()
    const frame = window.requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, categoryOptions])

  useEffect(() => {
    const open = () => openListeningRef.current()
    window.addEventListener('conora:open-voice', open)
    return () => window.removeEventListener('conora:open-voice', open)
  }, [])

  useEffect(() => {
    return () => {
      if (idleTimer.current) {
        window.clearTimeout(idleTimer.current)
      }
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

  function clearIdle() {
    if (idleTimer.current) {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = null
    }
  }

  function armIdle() {
    clearIdle()
    if (!activeRef.current || !micOnRef.current) {
      return
    }
    idleTimer.current = window.setTimeout(() => {
      void onIdle()
    }, 10_000)
  }

  async function onIdle() {
    if (!activeRef.current || !micOnRef.current || reviewRef.current) {
      return
    }
    if (idleAsked.current) {
      stopSession()
      return
    }
    idleAsked.current = true
    followUpRef.current = true
    clearCategoryPick()
    const turn = ++turnGen.current
    sessionRef.current?.pause()
    try {
      await say('Deseja mais alguma coisa ou podemos encerrar por aqui?')
    } finally {
      if (turn === turnGen.current && activeRef.current && micOnRef.current) {
        setModStatusRef.current(null)
        sessionRef.current?.resume()
        armIdle()
      }
    }
  }

  function showCategoryOptions(names: string[], slot: 'categoryName' | 'projectName' = 'categoryName') {
    const next = names.slice(0, 4)
    optionSlotRef.current = slot
    categoryOptionsRef.current = next
    categoryChoiceRef.current = null
    setOptionTitle(slot === 'projectName' ? 'Encontrei esses projetos' : 'Encontrei essas categorias')
    setCategoryOptions(next)
    setCategoryChoice(null)
  }

  function clearCategoryPick() {
    categoryOptionsRef.current = []
    categoryChoiceRef.current = null
    setCategoryOptions([])
    setCategoryChoice(null)
  }

  function stopSession() {
    activeRef.current = false
    micOnRef.current = false
    setActive(false)
    setChoosing(false)
    clearCategoryPick()
    pendingRef.current = null
    reviewRef.current = null
    setReview(null)
    followUpRef.current = false
    idleAsked.current = false
    clearIdle()
    historyRef.current = []
    turnGen.current += 1
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
      onActivity: () => {
        setModStatusRef.current('Lendo dados')
        armIdle()
      },
      onBarge: () => {
        turnGen.current += 1
        stopSpeaking()
        setModStatusRef.current('Lendo dados')
      },
      onPhrase: (phrase) => {
        clearIdle()
        idleAsked.current = false
        const turn = ++turnGen.current
        sessionRef.current?.pause()
        void (async () => {
          try {
            await handleUtterance(phrase)
          } catch (caught: unknown) {
            await say(errorMessage(caught))
          } finally {
            if (turn === turnGen.current && activeRef.current && micOnRef.current) {
              setModStatusRef.current(null)
              sessionRef.current?.resume()
              armIdle()
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
    if (!IAN_MIC_ENABLED) {
      return
    }
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
    armIdle()
  }

  function remember(role: VoiceTurn['role'], text: string) {
    const line = text.replace(/\s+/g, ' ').trim()
    if (!line) {
      return
    }
    historyRef.current = [...historyRef.current, { role, text: line }].slice(-12)
  }

  async function say(text: string) {
    clearIdle()
    if (!activeRef.current || !text.trim()) {
      return
    }
    const turn = turnGen.current
    const voiced = withName(text)
    remember('assistant', voiced)
    setModStatusRef.current('aguarde')
    sessionRef.current?.armBarge(voiced)
    await speakPt(voiced)
    if (turn !== turnGen.current) {
      return
    }
    sessionRef.current?.pause()
  }

  function dropEntry() {
    entryEpoch.current += 1
    pendingRef.current = null
    clearCategoryPick()
    clearVoiceDraft()
    clearVoiceFill()
  }

  function pickCategory(name: string) {
    turnGen.current += 1
    const turn = turnGen.current
    categoryChoiceRef.current = name
    setCategoryChoice(name)
    stopSpeaking()
    void say(`Você escolheu a categoria ${name}. Confirma?`).finally(() => {
      if (turn === turnGen.current && activeRef.current && micOnRef.current) {
        setModStatusRef.current(null)
        sessionRef.current?.resume()
      }
    })
  }

  async function acceptCategory(name: string) {
    const slot = optionSlotRef.current
    clearCategoryPick()
    const entry = pendingRef.current ?? emptyEntry()
    entry[slot] = name
    entry.asked = null
    pendingRef.current = entry
    await finishEntry(entry)
  }

  function reveal(entry: SpokenEntry) {
    if (entry.type === 'ProjectContribution') {
      return
    }
    publishVoiceFill({
      type: entry.type,
      amount: entry.amount,
      date: entry.date,
      description: entry.description,
      categoryName: entry.categoryName,
      accountName: entry.accountName,
    })
  }

  async function setVoiceConfirm(enabled: boolean) {
    const profile = await familyApi.profile()
    await familyApi.updatePreferences({
      themeId: profile.themeId,
      quietMode: profile.quietMode,
      emailsEnabled: profile.emailsEnabled,
      reserveTargetMonths: profile.reserveTargetMonths,
      monthCloseDay: profile.monthCloseDay,
      includeAbsoluteValuesInRetrospective: profile.includeAbsoluteValuesInRetrospective,
      voiceEntryConfirm: enabled,
      budgetAlertPercent: profile.budgetAlertPercent ?? 70,
      photoEvolutionEnabled: profile.photoEvolutionEnabled !== false,
    })
    confirmRef.current = enabled
    await say(enabled
      ? 'Confirmação do lançamento por voz ligada.'
      : 'Confirmação do lançamento por voz desligada. O lançamento entra direto.')
  }

  async function approveReview() {
    const entry = reviewRef.current
    if (!entry) {
      return
    }
    reviewRef.current = null
    setReview(null)
    await commitPending(entry)
  }

  async function finishEntry(entry: SpokenEntry) {
    if (entry.type === 'ProjectContribution') {
      entry.type = 'Income'
    }
    await fillAporteCategory(entry)
    if (entry.projectName && !entry.categoryName) {
      const project = await unknownProjectMessage(entry.projectName)
      if (project) {
        entry.projectName = null
        entry.asked = 'projectName'
        pendingRef.current = entry
        if (project.names.length > 0) {
          showCategoryOptions(project.names, 'projectName')
        } else {
          clearCategoryPick()
        }
        reveal(entry)
        await say(project.message)
        return
      }
    }
    if (entry.categoryName) {
      const suggestion = await unknownCategoryMessage(toDraft(entry))
      if (suggestion) {
        entry.categoryName = null
        entry.asked = 'categoryName'
        pendingRef.current = entry
        if (suggestion.names.length > 0) {
          showCategoryOptions(suggestion.names)
        } else {
          clearCategoryPick()
        }
        reveal(entry)
        await say(suggestion.message)
        return
      }
    }
    clearCategoryPick()
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
    if (confirmRef.current) {
      reviewRef.current = entry
      setReview({ ...entry })
      await say(reviewSpeech(entry))
      return
    }
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
      await offerMore('Gravei.')
      return
    }
    if (result.status === 'needs-form') {
      setVoiceDraft({ description: result.description, amount: result.amount })
      await say('Falta a conta bancária. Revise o lançamento e salve.')
      return
    }
    await say(result.message)
  }

  async function offerMore(done: string, question = 'Precisa de mais alguma coisa?') {
    followUpRef.current = true
    idleAsked.current = false
    const text = done.trim()
    await say(text ? `${text} ${question}` : question)
  }

  async function handleUtterance(text: string) {
    const spoken = text.trim()
    if (!spoken || !activeRef.current) {
      return
    }
    setModStatusRef.current('Lendo dados')
    const prior = historyRef.current.slice()
    remember('user', spoken)
    const folded = foldPhrase(spoken)

    if (/\b(desabilitar|desligar|desativar)\b/.test(folded) && /\bconfirmac/.test(folded)) {
      await setVoiceConfirm(false)
      return
    }
    if (/\b(habilitar|ligar|ativar)\b/.test(folded) && /\bconfirmac/.test(folded)) {
      await setVoiceConfirm(true)
      return
    }
    if (reviewRef.current) {
      if (isCancelPhrase(spoken)) {
        reviewRef.current = null
        setReview(null)
        dropEntry()
        await say('Lançamento cancelado.')
        stopSession()
        return
      }
      if (/^corrig/.test(folded)) {
        await say('Pode corrigir.')
        return
      }
      if (isApprovePhrase(spoken)) {
        await approveReview()
        return
      }
      const next = absorb(reviewRef.current, spoken)
      reviewRef.current = null
      setReview(null)
      await finishEntry(next)
      return
    }

    if (followUpRef.current) {
      followUpRef.current = false
      idleAsked.current = false
      if (isDonePhrase(spoken)) {
        await say('Certo.')
        stopSession()
        return
      }
      if (isYesPhrase(spoken)) {
        await say('Pode falar.')
        return
      }
      dropEntry()
    }

    if (categoryOptionsRef.current.length > 0) {
      if (categoryChoiceRef.current && isYesPhrase(spoken)) {
        await acceptCategory(categoryChoiceRef.current)
        return
      }
      if (categoryChoiceRef.current && isNoPhrase(spoken)) {
        categoryChoiceRef.current = null
        setCategoryChoice(null)
        await say('Qual categoria você escolhe?')
        return
      }
      const hit = matchCategoryOption(spoken, categoryOptionsRef.current)
      if (hit) {
        pickCategory(hit)
        return
      }
    }
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
    if (!looksLikeNavigation(spoken) && looksLikeBudget(spoken)) {
      await finishEntry(absorb(emptyBudget(), spoken))
      return
    }
    if (!looksLikeNavigation(spoken) && looksLikeEntry(spoken)) {
      await finishEntry(absorb(emptyEntry(), spoken))
      return
    }
    pendingRef.current = null

    const command = await aiApi.voice(spoken, currentCompetence(), prior)
    if (!activeRef.current) {
      return
    }
    const reply = command.reply?.trim() ?? ''
    if (/limite de chamadas foi consumido/i.test(reply)) {
      await say(reply)
      stopSession()
      return
    }
    if (command.intent === 'navigate' && isVoiceRoute(command.route)) {
      navigate(command.route)
      await offerMore(command.reply || 'Abrindo a tela.')
      return
    }
    if (command.intent === 'action' && command.action === 'create-budget' && command.entry) {
      const next = absorb(fromDraft({ ...command.entry, kind: 'budget' }), spoken)
      next.kind = 'budget'
      await finishEntry(next)
      return
    }
    if (command.intent === 'action' && command.action === 'create-entry' && command.entry) {
      const next = absorb(fromDraft(command.entry), spoken)
      await finishEntry(next)
      return
    }
    if (/em que posso ajudar/i.test(reply)) {
      followUpRef.current = true
      idleAsked.current = false
      await say(reply)
      return
    }
    await offerMore(reply || 'Bom dia! Em que posso ajudar?')
  }

  function greetAndListen(next: IanVoiceId) {
    const label = IAN_VOICES.find((voice) => voice.id === next)?.label ?? 'Ian'
    const turn = turnGen.current
    const name = spokenNameRef.current
    void say(name ? `Olá, ${name}. Eu sou o ${label}.` : `Olá, eu sou o ${label}.`).finally(() => {
      if (turn === turnGen.current && activeRef.current && micOnRef.current) {
        setModStatusRef.current(null)
        sessionRef.current?.resume()
      }
    })
  }

  function openListening() {
    if (!IAN_MIC_ENABLED) {
      return
    }
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
    const name = spokenNameRef.current
    void speakPt(name ? `Olá, ${name}. Eu sou o ${label}.` : `Olá, eu sou o ${label}.`, next)
  }

  if (!anchor) {
    return null
  }

  const compact = anchor.id === 'conora-voice-header'

  return (
    <>
    {createPortal(
    <div className={`${active ? styles.dockOpen : styles.dock}${compact ? ` ${styles.dockCompact}` : ''}`}>
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
            <img className={styles.agentFace} src={ianPortrait('ian')} alt="" />
          </button>
          <button
            type="button"
            className={voiceId === 'clara' ? styles.pickOn : styles.pick}
            aria-label="Clara"
            aria-pressed={voiceId === 'clara'}
            onClick={() => selectVoice('clara')}
          >
            <img className={styles.agentFace} src={ianPortrait('clara')} alt="" />
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
        aria-label={IAN_MIC_ENABLED ? 'Falar com o Ian' : 'Modo de voz do Ian indisponível'}
        aria-pressed={active}
        aria-disabled={!IAN_MIC_ENABLED}
        disabled={!IAN_MIC_ENABLED}
        title={IAN_MIC_ENABLED ? undefined : 'Modo de voz do Ian indisponível'}
        onClick={(event) => {
          if (!IAN_MIC_ENABLED) {
            return
          }
          if (compact || event.detail === 0) {
            openListening()
          }
        }}
        onDoubleClick={() => {
          if (!IAN_MIC_ENABLED) {
            return
          }
          if (!compact) {
            openListening()
          }
        }}
      >
        <img className={styles.agentFace} src={ianPortrait(voiceId)} alt="" />
        {active ? (
          <span className={styles.agentMod}>
            {modStatus ? <span className={styles.modStatus}>{modStatus}</span> : null}
            <VoiceOscillator levelsRef={levelsRef} compact tone="cursor" />
          </span>
        ) : null}
      </button>
    </div>,
    anchor,
    )}
    {categoryOptions.length > 0 && categoryBox
      ? createPortal(
        <div
          ref={categoryPopRef}
          className={styles.categoryPop}
          style={{ left: categoryBox.left, top: categoryBox.top }}
          role="dialog"
          aria-label={optionTitle}
        >
          <p className={styles.categoryPopTitle}>{optionTitle}</p>
          <div className={styles.categoryPopList}>
            {categoryOptions.map((name) => (
              <button
                key={name}
                type="button"
                className={categoryChoice === name ? styles.categoryPopOn : styles.categoryPopItem}
                aria-pressed={categoryChoice === name}
                onClick={() => pickCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
      : null}
    {review
      ? createPortal(
        <div className={styles.categoryPop} style={{ left: '50%', top: '42%' }} role="dialog" aria-label="Confirmar lançamento">
          <p className={styles.categoryPopTitle}>Confirmar lançamento</p>
          <div className={styles.categoryPopList}>
            <p className={styles.categoryPopItem}>{review.type === 'Income' ? 'Receita' : 'Despesa'}</p>
            <p className={styles.categoryPopItem}>{review.amount == null ? '' : formatMoney(review.amount)}</p>
            <p className={styles.categoryPopItem}>{review.description}</p>
            <p className={styles.categoryPopItem}>{review.categoryName}</p>
            <p className={styles.categoryPopItem}>{review.accountName}</p>
            <p className={styles.categoryPopItem}>{formatDate(dateToApi(resolveSpokenDate(review.date)))}</p>
          </div>
          <button type="button" className={styles.categoryPopOn} onClick={() => void approveReview()}>
            Aprovar
          </button>
          <button type="button" className={styles.categoryPopItem} onClick={() => void say('Pode corrigir.')}>
            Corrigir
          </button>
        </div>,
        document.body,
      )
      : null}
    </>
  )
}
