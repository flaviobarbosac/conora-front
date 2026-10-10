import { useEffect, useState } from 'react'
import { registerSaveToastHandler } from '../lib/saveToast'
import styles from './SaveToast.module.css'

/** Standard success toast. Duration comes from showSaveToast (default 2s). */
export function SaveToastHost() {
  const [message, setMessage] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(2000)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    registerSaveToastHandler((next, nextDuration) => {
      setMessage(next)
      setDurationMs(nextDuration)
      setTick((current) => current + 1)
    })
    return () => registerSaveToastHandler(null)
  }, [])

  useEffect(() => {
    if (!message) {
      return
    }
    const timer = window.setTimeout(() => setMessage(null), durationMs)
    return () => window.clearTimeout(timer)
  }, [message, durationMs, tick])

  if (!message) {
    return null
  }

  return (
    <div className={styles.toastOk} role="status">
      {message}
    </div>
  )
}
