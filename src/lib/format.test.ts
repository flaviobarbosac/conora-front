import { describe, expect, it } from 'vitest'
import {
  competencesFrom,
  currentCompetence,
  dateToApi,
  errorMessage,
  formatCompetence,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatMoneyInput,
  formatPercent,
  formatPercentValue,
  isMoneyCompact,
  monthsInclusive,
  parseMoney,
  sanitizeMoneyTyping,
  shiftCompetence,
  todayInput,
} from './format'

describe('sanitizeMoneyTyping', () => {
  it('formats cents from the right while typing', () => {
    expect(sanitizeMoneyTyping('3')).toBe(formatMoneyInput(0.03))
    expect(sanitizeMoneyTyping('30')).toBe(formatMoneyInput(0.3))
    expect(sanitizeMoneyTyping('300')).toBe(formatMoneyInput(3))
    expect(sanitizeMoneyTyping('3000')).toBe(formatMoneyInput(30))
    expect(sanitizeMoneyTyping('300000')).toBe(formatMoneyInput(3000))
  })

  it('formats values up to ~99 million', () => {
    expect(sanitizeMoneyTyping('9999999999')).toBe(formatMoneyInput(99_999_999.99))
  })

  it('keeps 1 million, 10 million and 99 million intact', () => {
    expect(sanitizeMoneyTyping('100000000')).toBe(formatMoneyInput(1_000_000))
    expect(sanitizeMoneyTyping('1000000000')).toBe(formatMoneyInput(10_000_000))
    expect(sanitizeMoneyTyping('9900000000')).toBe(formatMoneyInput(99_000_000))
    expect(sanitizeMoneyTyping('100000000')).not.toBe(formatMoneyInput(999_999.99))
  })

  it('caps at 10 digits', () => {
    expect(sanitizeMoneyTyping('1234567890123')).toBe(formatMoneyInput(12_345_678.9))
  })

  it('strips non-digits and keeps empty', () => {
    expect(sanitizeMoneyTyping('')).toBe('')
    expect(sanitizeMoneyTyping('abc')).toBe('')
    expect(sanitizeMoneyTyping('1.234,56')).toBe(formatMoneyInput(1_234.56))
  })
})

describe('parseMoney', () => {
  it('parses pt-BR and plain decimals', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56)
    expect(parseMoney('1234.56')).toBe(1234.56)
    expect(parseMoney('R$ 10,00')).toBe(10)
  })

  it('returns NaN for blank', () => {
    expect(Number.isNaN(parseMoney(''))).toBe(true)
    expect(Number.isNaN(parseMoney('   '))).toBe(true)
  })
})

describe('formatPercent', () => {
  it('uses comma decimal and percent sign', () => {
    expect(formatPercent(-100)).toBe('-100,0%')
    expect(formatPercent(12.5)).toBe('12,5%')
    expect(formatPercent(null)).toBe('0,0%')
  })

  it('exposes the figure without the percent sign for labeled columns', () => {
    expect(formatPercentValue(12.5)).toBe('12,5')
    expect(formatPercentValue(null)).toBe('0,0')
  })
})

describe('formatMoneyCompact', () => {
  it('keeps full currency below 10 mil', () => {
    expect(formatMoneyCompact(9_999.99)).toBe(formatMoney(9_999.99))
    expect(isMoneyCompact(9_999.99)).toBe(false)
  })

  it('abbreviates from 10 mil reais', () => {
    expect(formatMoneyCompact(10_000)).toBe('10 mil')
    expect(formatMoneyCompact(15_400)).toBe('15 mil')
    expect(formatMoneyCompact(100_000)).toBe('100 mil')
    expect(formatMoneyCompact(250_500)).toBe('251 mil')
    expect(isMoneyCompact(10_000)).toBe(true)
  })

  it('abbreviates millions', () => {
    expect(formatMoneyCompact(1_000_000)).toBe('1 mi')
    expect(formatMoneyCompact(1_250_000)).toBe('1,3 mi')
    expect(formatMoneyCompact(12_000_000)).toBe('12 mi')
  })

  it('keeps the minus sign', () => {
    expect(formatMoneyCompact(-15_000)).toBe('-15 mil')
    expect(formatMoneyCompact(-150_000)).toBe('-150 mil')
    expect(formatMoneyCompact(-2_500_000)).toBe('-2,5 mi')
  })
})

describe('competence helpers', () => {
  it('shifts across year boundary', () => {
    expect(shiftCompetence('2026-12', 1)).toBe('2027-01')
    expect(shiftCompetence('2026-01', -1)).toBe('2025-12')
  })

  it('lists inclusive months', () => {
    expect(monthsInclusive('2026-10', '2026-12')).toEqual(['2026-10', '2026-11', '2026-12'])
    expect(monthsInclusive('2026-12', '2026-10')).toEqual([])
  })

  it('builds competence ranges and labels', () => {
    expect(competencesFrom('2026-11', 2)).toEqual(['2026-11', '2026-12'])
    expect(competencesFrom('2026-11', 0)).toEqual([])
    expect(currentCompetence()).toMatch(/^\d{4}-\d{2}$/)
    expect(formatCompetence('2026-03')).toMatch(/2026/)
  })
})

describe('date helpers', () => {
  it('formats and converts dates', () => {
    expect(todayInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(dateToApi('2026-10-15')).toBe('2026-10-15T12:00:00Z')
    expect(formatDate('2026-10-15T12:00:00Z')).toBe('15/10/2026')
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime(null)).toBe('—')
    // 12:00 UTC → 09:00 in America/Sao_Paulo
    expect(formatDateTime('2026-10-15T12:00:00Z')).toMatch(/15\/10\/2026/)
    expect(formatDateTime('2026-10-15T12:00:00Z')).toMatch(/09:00/)
  })

  it('formats money and error messages', () => {
    expect(formatMoney(10)).toContain('10')
    expect(formatMoney(null)).toContain('0')
    expect(errorMessage(new Error('falhou'))).toBe('falhou')
    expect(errorMessage('x')).toBe('Algo deu errado. Tente novamente.')
  })
})
