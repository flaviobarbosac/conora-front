import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../lib/format'

type LoadState<T> = { data: T | null; error: string | null; loading: boolean }

/** Loads data on mount and whenever `deps` change; `reload` forces a refetch. */
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<LoadState<T>>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((current) => ({ ...current, loading: true, error: null }))
    loader()
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, loading: false })
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setState((current) => ({ data: current.data, error: errorMessage(caught), loading: false }))
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  return { ...state, reload }
}
