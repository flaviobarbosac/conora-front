import { useEffect, useRef } from 'react'
import { VOICE_BAR_COUNT } from '../lib/voiceVisualizer'
import styles from './VoiceOscillator.module.css'

type Props = {
  levelsRef: { current: number[] }
  compact?: boolean
  tone?: 'cursor'
}

/** Animated bars driven by the microphone analyser. */
export function VoiceOscillator({ levelsRef, compact = false, tone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const bars = Array.from(root.children) as HTMLElement[]
    let frame = 0
    const tick = () => {
      const levels = levelsRef.current
      bars.forEach((bar, index) => {
        bar.style.transform = `scaleY(${levels[index] ?? 0.12})`
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [levelsRef])

  return (
    <div
      ref={rootRef}
      className={[styles.oscillator, compact ? styles.compact : '', tone === 'cursor' ? styles.cursor : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {Array.from({ length: VOICE_BAR_COUNT }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}
