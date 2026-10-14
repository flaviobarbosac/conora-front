import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isDarkTheme, normalizeThemeId, ThemeId, type ThemeId as ThemeIdType } from './themes'

const STORAGE_KEY = 'conora.theme'
const LEGACY_STORAGE_KEY = 'onra.theme'

/** @deprecated Use ThemeId */
export const ThemeName = {
  Light: ThemeId.Clareza,
  Dark: ThemeId.Noite,
} as const

export type Theme = ThemeIdType

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme | string) => void
  toggleTheme: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
  return normalizeThemeId(stored)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }, [theme])

  const setTheme = useCallback((next: Theme | string) => {
    setThemeState(normalizeThemeId(next))
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === ThemeId.Noite ? ThemeId.Clareza : ThemeId.Noite))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDark: isDarkTheme(theme),
    }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export { ThemeId }
