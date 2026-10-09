import { useEffect, useState } from 'react'
import { registerSaveToastHandler } from '../lib/saveToast'
import styles from './SaveToast.module.css'

/** Standard success toast. Closes itself after 2 seconds. */
export function SaveToastHost() {
  const [message, setMessage] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    registerSaveToastHandler((next) => {
      setMessage(next)
      setTick((current) => current + 1)
    })
    return () => registerSaveToastHandler(null)
  }, [])

  useEffect(() => {
    if (!message) {
      return
    }
    const timer = window.setTimeout(() => setMessage(null), 2000)
    return () => window.clearTimeout(timer)
  }, [message, tick])

  if (!message) {
    return null
  }

  return (
    <div className={styles.toastOk} role="status">
      {message}
    </div>
  )
}
