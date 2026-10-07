import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { Button } from './ui/Button'
import styles from './Splash.module.css'

const MIN_MS = 800
const SLOW_MS = 3000
const FAIL_MS = 8000
const SEEN_KEY = 'conora.seenHome'

function firstName(email: string): string {
  const local = email.split('@')[0] ?? ''
  const part = local.split(/[._-]/).find(Boolean) ?? local
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
  const reduced = prefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(reduced ? 1 : 0)
  const onraLogo = `${import.meta.env.BASE_URL}brand/${theme === 'dark' ? 'logo-escuro' : 'logo-claro'}.png`
  const name = session ? firstName(session.email) : ''
  const firstVisit = !hasSeenHome()

  useEffect(() => {
    if (reduced) {
      const wait = window.setTimeout(() => setPhase('leaving'), MIN_MS)
      return () => window.clearTimeout(wait)
    }

    const start = Date.now()
    let frame = 0
    const tick = () => {
      const elapsed = Date.now() - start
      const fake = Math.min(0.9, elapsed / 1600)
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
        setPhase('leaving')
        return
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [reduced])

  useEffect(() => {
    if (phase !== 'leaving') {
      return
    }
    if (session) {
      localStorage.setItem(SEEN_KEY, '1')
    }
    const hold = reduced ? 0 : 440
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
