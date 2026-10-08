import { describe, expect, it } from 'vitest'
import {
  formatMoneyInput,
  formatPercent,
  parseMoney,
  sanitizeMoneyTyping,
  shiftCompetence,
  monthsInclusive,
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
})
