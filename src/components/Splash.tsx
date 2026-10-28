import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { hasKnownAccount, markKnownAccount } from '../lib/deviceIdentity'
import { isDarkTheme } from '../theme/themes'
import { useTheme } from '../theme/ThemeProvider'
import { Button } from './ui/Button'
import styles from './Splash.module.css'

const MIN_MS_FIRST = 2240
const MIN_MS_RETURN = 800
const SLOW_MS = 8400
const FAIL_MS = 22400

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Phase = 'loading' | 'slow' | 'error' | 'leaving' | 'done'

export function Splash({ onFinished }: { onFinished: () => void }) {
  const { session, authReady } = useAuth()
  const { theme } = useTheme()
  const reduced = prefersReducedMotion()
  const firstVisit = !hasKnownAccount()
  const minMs = firstVisit ? MIN_MS_FIRST : MIN_MS_RETURN
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(reduced ? 1 : 0)
  const [animationDone, setAnimationDone] = useState(reduced)
  const onraLogo = `${import.meta.env.BASE_URL}brand/${isDarkTheme(theme) ? 'logo-escuro' : 'logo-claro'}.png`

  useEffect(() => {
    if (reduced) {
      const wait = window.setTimeout(() => setAnimationDone(true), minMs)
      return () => window.clearTimeout(wait)
    }

    const start = Date.now()
    let frame = 0
    const progressSpan = Math.max(minMs * 2, 1600)
    const tick = () => {
      const elapsed = Date.now() - start
      const fake = Math.min(0.9, elapsed / progressSpan)
      setProgress(fake)
      if (elapsed >= FAIL_MS) {
        setPhase('error')
        return
      }
      if (elapsed >= SLOW_MS) {
        setPhase((current) => (current === 'loading' ? 'slow' : current))
      }
      if (elapsed >= minMs && fake >= 0.9) {
        setProgress(1)
        setAnimationDone(true)
        return
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [reduced, minMs])

  useEffect(() => {
    if (phase === 'error' || phase === 'leaving' || phase === 'done') {
      return
    }
    // Wait for session restore so the next screen is already the right one (app / login / register).
    if (animationDone && authReady) {
      setPhase('leaving')
    }
  }, [animationDone, authReady, phase])

  useEffect(() => {
    if (phase !== 'leaving') {
      return
    }
    if (session) {
      markKnownAccount()
    }
    const hold = reduced ? 0 : firstVisit ? 1232 : 320
    const timer = window.setTimeout(() => {
      setPhase('done')
      onFinished()
    }, hold)
    return () => window.clearTimeout(timer)
  }, [phase, onFinished, session, reduced, firstVisit])

  if (phase === 'done') {
    return null
  }

  let caption = 'Carregando…'
  if (session) {
    caption = phase === 'slow' ? 'Quase lá…' : 'Preparando seu mês…'
  } else if (phase === 'slow') {
    caption = 'Quase lá…'
  }

  return (
    <div className={styles.overlay} data-leaving={phase === 'leaving' ? 'true' : 'false'}>
      <div className={styles.mark} aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}brand/simbolo.png`} alt="" />
      </div>
      <div className={styles.stage}>
        <p className={styles.brand}>Conora</p>
        <div className={styles.copy}>
          <span className={styles.caption}>{caption}</span>
          <div className={styles.bar} aria-hidden="true">
            <div className={styles.barFill} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          {phase === 'error' ? (
            <div className={styles.retry}>
              <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.signature}>
        <span>uma solução</span>
        <img src={onraLogo} alt="Onra" />
      </div>
    </div>
  )
}
