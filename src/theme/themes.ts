export const ThemeId = {
  Clareza: 'clareza',
  Noite: 'noite',
  Contraste: 'contraste',
  Salvia: 'salvia',
  Lavanda: 'lavanda',
  Terracota: 'terracota',
} as const

export type ThemeId = (typeof ThemeId)[keyof typeof ThemeId]

export type ThemeMeta = {
  id: ThemeId
  label: string
  climate: string
  requiresAnnual: boolean
}

export const ALL_THEMES: ReadonlyArray<ThemeMeta> = [
  { id: ThemeId.Clareza, label: 'Clareza', climate: 'Neutro, profissional', requiresAnnual: false },
  { id: ThemeId.Noite, label: 'Noite', climate: 'Calmo, foco', requiresAnnual: false },
  { id: ThemeId.Contraste, label: 'Alto contraste', climate: 'Acessibilidade', requiresAnnual: false },
  { id: ThemeId.Salvia, label: 'Sálvia', climate: 'Sereno, natural', requiresAnnual: false },
  { id: ThemeId.Lavanda, label: 'Lavanda', climate: 'Leve, acolhedor', requiresAnnual: false },
  { id: ThemeId.Terracota, label: 'Terracota', climate: 'Quente, aconchegante', requiresAnnual: false },
]

export function normalizeThemeId(value: string | null | undefined): ThemeId {
  const raw = (value ?? '').trim().toLowerCase()
  if (raw === 'light') return ThemeId.Clareza
  if (raw === 'dark') return ThemeId.Noite
  const match = ALL_THEMES.find((theme) => theme.id === raw)
  return match?.id ?? ThemeId.Clareza
}

export function isDarkTheme(theme: ThemeId): boolean {
  return theme === ThemeId.Noite || theme === ThemeId.Contraste
}
