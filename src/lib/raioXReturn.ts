const STORAGE_KEY = 'conora:raiox-return'

export type RaioXReturnState = {
  path: string
  scrollY: number
  openIds: string[]
  competenceYm: string
  months: number
  leakageOnly: boolean
  /** Analytical account that was clicked — restored into view on return. */
  categoryId?: string
}

function isSafeRaioXPath(path: string): boolean {
  return path.startsWith('/raio-x') && !path.startsWith('//')
}

/** Persist full Raio-X view state before navigating to entries. */
export function saveRaioXReturn(state: RaioXReturnState): void {
  if (!isSafeRaioXPath(state.path)) {
    return
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readRaioXReturn(): RaioXReturnState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<RaioXReturnState>
    if (
      typeof parsed.path !== 'string' ||
      !isSafeRaioXPath(parsed.path) ||
      typeof parsed.scrollY !== 'number' ||
      !Array.isArray(parsed.openIds) ||
      typeof parsed.competenceYm !== 'string' ||
      typeof parsed.months !== 'number'
    ) {
      return null
    }
    return {
      path: parsed.path,
      scrollY: parsed.scrollY,
      openIds: parsed.openIds.filter((id): id is string => typeof id === 'string'),
      competenceYm: parsed.competenceYm,
      months: parsed.months,
      leakageOnly: Boolean(parsed.leakageOnly),
      categoryId: typeof parsed.categoryId === 'string' ? parsed.categoryId : undefined,
    }
  } catch {
    return null
  }
}

export function clearRaioXReturn(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Query param from Lançamentos → Raio-X only. */
export function safeRaioXReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return null
  }
  if (!raw.startsWith('/raio-x')) {
    return null
  }
  return raw
}
