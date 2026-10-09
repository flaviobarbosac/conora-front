import { useCallback, useState } from 'react'
import { errorMessage } from '../lib/format'

/** Wraps a mutation: tracks busy/error state and resolves to true on success. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (caught) {
      setError(errorMessage(caught))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, run, setError }
}
