/** Device has already used Conora (login/register) — show Entrar, not Criar conta. */
const KNOWN_ACCOUNT_KEY = 'conora.knownAccount'
const SEEN_HOME_KEY = 'conora.seenHome'
const LEGACY_SEEN_HOME_KEY = 'onra.seenHome'

export function hasKnownAccount(): boolean {
  return Boolean(
    localStorage.getItem(KNOWN_ACCOUNT_KEY) ||
      localStorage.getItem(SEEN_HOME_KEY) ||
      localStorage.getItem(LEGACY_SEEN_HOME_KEY),
  )
}

/** Call after a successful auth so the next cold start opens Entrar, not Criar conta. */
export function markKnownAccount(): void {
  localStorage.setItem(KNOWN_ACCOUNT_KEY, '1')
  localStorage.setItem(SEEN_HOME_KEY, '1')
}

/** Guest entry after splash / protected route: first device → register, else login. */
export function guestAuthPath(): string {
  return hasKnownAccount() ? '/login' : '/register'
}
