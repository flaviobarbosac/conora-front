const CLIENT_KEY = 'conora.sharedClient'
const MONTH_KEY = 'conora.sharedMonth'

export function enterSharedMonth(clientId: string, competenceYm: string): void {
  sessionStorage.setItem(CLIENT_KEY, clientId)
  sessionStorage.setItem(MONTH_KEY, competenceYm)
}

export function sharedCompetence(): string | null {
  const month = sessionStorage.getItem(MONTH_KEY)
  return month && /^\d{4}-\d{2}$/.test(month) ? month : null
}

export function readSharedClient(): { clientId: string; competenceYm: string } | null {
  const clientId = sessionStorage.getItem(CLIENT_KEY)
  const competenceYm = sharedCompetence()
  if (!clientId || !competenceYm) return null
  return { clientId, competenceYm }
}

export function clearSharedMonth(): void {
  sessionStorage.removeItem(CLIENT_KEY)
  sessionStorage.removeItem(MONTH_KEY)
}
