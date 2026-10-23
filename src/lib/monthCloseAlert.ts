/** Brazil calendar day 1–5 window for the “close previous month” alert. */

export function isMonthCloseReminderWindow(now: Date = new Date()): boolean {
  const day = brazilDayOfMonth(now)
  return day >= 1 && day <= 5
}

export function brazilDayOfMonth(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
  }).formatToParts(now)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return Number.isFinite(day) ? day : now.getUTCDate()
}
