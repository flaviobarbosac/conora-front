import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const ThemeName = {
  Light: 'light',
  Dark: 'dark',
} as const

export type Theme = (typeof ThemeName)[keyof typeof ThemeName]

const STORAGE_KEY = 'conora.theme'
const LEGACY_STORAGE_KEY = 'onra.theme'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
  return stored === ThemeName.Dark ? ThemeName.Dark : ThemeName.Light
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () =>
        setThemeState((current) => (current === ThemeName.Light ? ThemeName.Dark : ThemeName.Light)),
    }),
    [theme],
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
