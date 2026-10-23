import { describe, expect, it } from 'vitest'
import { brazilDayOfMonth, isMonthCloseReminderWindow } from './monthCloseAlert'

describe('month close reminder window', () => {
  it('is active on days 1–5 in America/Sao_Paulo', () => {
    // 2026-10-03 15:00 UTC = still day 3 in BR
    expect(isMonthCloseReminderWindow(new Date('2026-10-03T15:00:00Z'))).toBe(true)
    // 2026-10-06 03:00 UTC = day 6 in BR
    expect(isMonthCloseReminderWindow(new Date('2026-10-06T03:00:00Z'))).toBe(false)
  })

  it('reads Brazil day, not raw UTC when near midnight', () => {
    // 2026-10-01 02:00 UTC = still 30 Sep in BR → outside window
    expect(brazilDayOfMonth(new Date('2026-10-01T02:00:00Z'))).toBe(30)
    // 2026-10-01 06:00 UTC = 1 Oct in BR
    expect(brazilDayOfMonth(new Date('2026-10-01T06:00:00Z'))).toBe(1)
  })
})
