import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dashboardApi, familyApi } from '../api/finance'
import { scanReceipt } from '../camera/scanReceipt'
import { HomeLaunchO } from '../components/HomeLaunchO'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorText } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'
import { useLoad } from '../hooks/useLoad'
import { currentCompetence } from '../lib/format'
import {
  beginVoiceListen,
  setVoiceDraft,
  speechRecognitionAvailable,
  type VoiceListenHandle,
} from '../lib/voiceDraft'
import styles from './page.module.css'

const VOICE_MAX_SEC = 30

function firstName(fullName: string | undefined): string {
  const trimmed = fullName?.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.split(/\s+/).find(Boolean) ?? trimmed
}

export function HomePage() {
  const navigate = useNavigate()
  const profile = useLoad(() => familyApi.profile(), [])
  const dashboard = useLoad(() => dashboardApi.get(currentCompetence()), [])
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(VOICE_MAX_SEC)
  const handleRef = useRef<VoiceListenHandle | null>(null)
  const name = firstName(profile.data?.name)
  const pendingCategories = dashboard.data?.alerts.find((alert) => alert.code === 'CATEGORY_PENDING_REVIEW')

  useEffect(() => {
    if (!listening) {
      return
    }
    setSecondsLeft(VOICE_MAX_SEC)
    const tick = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 1 ? 0 : value - 1))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [listening])

  useEffect(() => {
    return () => {
      handleRef.current?.cancel()
      handleRef.current = null
    }
  }, [])

  function openManual() {
    navigate('/lancamentos?novo=1')
  }

  function openScan() {
    void scanReceipt()
      .then(() => navigate('/lancamentos?novo=1&recibo=1'))
      .catch(() => undefined)
  }

  function openVoice() {
    setVoiceError(null)
    if (!speechRecognitionAvailable()) {
      setVoiceError('Este navegador não liberou o microfone para ditado.')
      return
    }

    const handle = beginVoiceListen({
      maxMs: VOICE_MAX_SEC * 1000,
      onTranscript: setTranscript,
    })
    handleRef.current = handle
    setTranscript('')
    setListening(true)

    void handle.promise
      .then((draft) => {
        setVoiceDraft(draft)
        setListening(false)
        handleRef.current = null
        navigate('/lancamentos?novo=1&voz=1')
      })
      .catch((caught: unknown) => {
        setListening(false)
        handleRef.current = null
        const message = caught instanceof Error ? caught.message : 'Não foi possível usar o microfone.'
        if (message === 'Ditado cancelado.') {
          return
        }
        setVoiceError(message)
      })
  }

  function confirmVoice() {
    handleRef.current?.confirm()
  }

  function cancelVoice() {
    handleRef.current?.cancel()
  }

  return (
    <div className={`${styles.page} ${styles.homePage}`}>
      <PageHeader kicker="Início" title={name ? `Olá, ${name}` : 'Olá'} />

      <ErrorText message={dashboard.error ?? profile.error ?? voiceError} />

      {pendingCategories ? (
        <Link className={styles.homeUrgent} to="/categorias">
          <Icon name="alert" size={20} />
          <span>{pendingCategories.message}</span>
        </Link>
      ) : null}

      <section className={styles.homeLaunch} aria-label="Lançamento">
        <HomeLaunchO listening={listening} onScan={openScan} onVoice={openVoice} onManual={openManual} />
      </section>

      {listening ? (
        <div
          className={styles.sheetOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelVoice()
            }
          }}
        >
          <div
            className={`${styles.sheet} ${styles.voiceListenSheet}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-listen-title"
          >
            <div className={styles.voiceListenHead}>
              <span className={styles.voiceListenMic} aria-hidden>
                <Icon name="mic" size={24} />
              </span>
              <h2 id="voice-listen-title" className={styles.sectionTitle}>
                Ouvindo…
              </h2>
            </div>
            <p className={styles.muted}>
              Fale o lançamento. Confirme quando terminar ou aguarde {secondsLeft}s.
            </p>
            <p className={styles.voiceListenTranscript} aria-live="polite">
              {transcript || 'Aguardando sua fala…'}
            </p>
            <div className={styles.formActions}>
              <Button type="button" variant="secondary" onClick={cancelVoice}>
                Cancelar
              </Button>
              <Button type="button" onClick={confirmVoice} disabled={!transcript.trim()}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
