import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmLeaveUnsaved } from '../lib/confirm'

type UnsavedChangesApi = {
  /** Registers whether a screen/form currently has unsaved edits. */
  setDirty: (key: string, dirty: boolean) => void
  /** True when any registered editor is dirty. */
  isDirty: boolean
  /** Confirms leave when dirty; returns true when navigation/close may proceed. */
  confirmLeave: () => Promise<boolean>
  /** Clears all dirty flags (after confirmed leave). */
  clearAll: () => void
}

const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null)

/** Strips BrowserRouter basename so navigate() does not double-prefix `/app`. */
function toRouterPath(pathname: string, search: string, hash: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  let path = pathname
  if (base && base !== '/' && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length) || '/'
  }
  return `${path}${search}${hash}`
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const navigate = useNavigate()

  const isDirty = useMemo(() => Object.values(flags).some(Boolean), [flags])

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setFlags((current) => {
      if (!dirty) {
        if (!(key in current)) {
          return current
        }
        const next = { ...current }
        delete next[key]
        return next
      }
      if (current[key]) {
        return current
      }
      return { ...current, [key]: true }
    })
  }, [])

  const clearAll = useCallback(() => setFlags({}), [])

  const confirmLeave = useCallback(async () => {
    if (!Object.values(flags).some(Boolean)) {
      return true
    }
    const ok = await confirmLeaveUnsaved()
    if (ok) {
      setFlags({})
    }
    return ok
  }, [flags])

  useEffect(() => {
    if (!isDirty) {
      return
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) {
      return
    }

    function isInternalLink(anchor: HTMLAnchorElement): boolean {
      if (anchor.target && anchor.target !== '_self') {
        return false
      }
      if (anchor.hasAttribute('download')) {
        return false
      }
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return false
      }
      try {
        const url = new URL(anchor.href, window.location.href)
        return url.origin === window.location.origin
      } catch {
        return false
      }
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || !isInternalLink(anchor)) {
        return
      }
      const nextPath = toRouterPath(anchor.pathname, anchor.search, anchor.hash)
      const currentPath = toRouterPath(
        window.location.pathname,
        window.location.search,
        window.location.hash,
      )
      if (nextPath === currentPath) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void (async () => {
        if (await confirmLeave()) {
          navigate(nextPath)
        }
      })()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [confirmLeave, isDirty, navigate])

  const value = useMemo(
    () => ({ setDirty, isDirty, confirmLeave, clearAll }),
    [setDirty, isDirty, confirmLeave, clearAll],
  )

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>
}

export function useUnsavedChanges(): UnsavedChangesApi {
  const ctx = useContext(UnsavedChangesContext)
  if (!ctx) {
    throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider')
  }
  return ctx
}

/** Keeps the global dirty registry in sync with a local editor state. */
export function useRegisterDirty(key: string, dirty: boolean) {
  const { setDirty } = useUnsavedChanges()
  useEffect(() => {
    setDirty(key, dirty)
    return () => setDirty(key, false)
  }, [key, dirty, setDirty])
}
