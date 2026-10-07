import { useEffect, useState } from 'react'
import { familyApi } from '../api/finance'
import { useAuth } from '../auth/AuthProvider'
import { useLoad } from '../hooks/useLoad'
import { useTheme } from '../theme/ThemeProvider'
import { Button } from './ui/Button'
import styles from './Splash.module.css'

const MIN_MS = 2240
const SLOW_MS = 8400
const FAIL_MS = 22400
const SEEN_KEY = 'conora.seenHome'

function firstName(displayName: string): string {
  const part = displayName.trim().split(/\s+/).find(Boolean) ?? ''
  if (!part) {
    return ''
  }
  return part.charAt(0).toUpperCase() + part.slice(1)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function hasSeenHome(): boolean {
  return Boolean(localStorage.getItem(SEEN_KEY) ?? localStorage.getItem('onra.seenHome'))
}

type Phase = 'loading' | 'slow' | 'error' | 'leaving' | 'done'

export function Splash({ onFinished }: { onFinished: () => void }) {
  const { session } = useAuth()
  const { theme } = useTheme()
  const profile = useLoad(() => familyApi.profile(), [session?.email])
  const reduced = prefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(reduced ? 1 : 0)
  const [animationDone, setAnimationDone] = useState(reduced)
  const onraLogo = `${import.meta.env.BASE_URL}brand/${theme === 'dark' ? 'logo-escuro' : 'logo-claro'}.png`
  const name = session ? firstName(profile.data?.name ?? '') : ''
  const firstVisit = !hasSeenHome()
  const profileReady = !session || !profile.loading

  useEffect(() => {
    if (reduced) {
      const wait = window.setTimeout(() => setAnimationDone(true), MIN_MS)
      return () => window.clearTimeout(wait)
    }

    const start = Date.now()
    let frame = 0
    const tick = () => {
      const elapsed = Date.now() - start
      const fake = Math.min(0.9, elapsed / 4480)
      setProgress(fake)
      if (elapsed >= FAIL_MS) {
        setPhase('error')
        return
      }
      if (elapsed >= SLOW_MS) {
        setPhase((current) => (current === 'loading' ? 'slow' : current))
      }
      if (elapsed >= MIN_MS && fake >= 0.9) {
        setProgress(1)
        setAnimationDone(true)
        return
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [reduced])

  useEffect(() => {
    if (phase === 'error' || phase === 'leaving' || phase === 'done') {
      return
    }
    if (animationDone && profileReady) {
      setPhase('leaving')
    }
  }, [animationDone, profileReady, phase])

  useEffect(() => {
    if (phase !== 'leaving') {
      return
    }
    if (session) {
      localStorage.setItem(SEEN_KEY, '1')
    }
    const hold = reduced ? 0 : 1232
    const timer = window.setTimeout(() => {
      setPhase('done')
      onFinished()
    }, hold)
    return () => window.clearTimeout(timer)
  }, [phase, onFinished, session, reduced])

  if (phase === 'done') {
    return null
  }

  let caption = 'Carregando…'
  let hello = ''
  if (session && name) {
    hello = firstVisit ? `Bem-vindo, ${name}` : `Olá, ${name}`
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
          {hello ? <span className={styles.hello}>{hello}</span> : null}
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
