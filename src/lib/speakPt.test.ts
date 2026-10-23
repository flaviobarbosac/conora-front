import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { IAN_AGES, getIanAge, ianPortrait, setIanMaturity, voiceBandForAge } from './speakPt'

vi.mock('../api/client', () => ({ apiPostBlob: vi.fn() }))

beforeAll(() => {
  vi.stubGlobal('window', new EventTarget())
})

afterEach(() => setIanMaturity(null))

describe('voiceBandForAge', () => {
  it('groups the nine portraits into four voices', () => {
    expect(IAN_AGES.map(voiceBandForAge)).toEqual([
      'child',
      'child',
      'preteen',
      'preteen',
      'preteen',
      'teen',
      'teen',
      'adult',
      'adult',
    ])
  })

  it('keeps the adult voice while the age is unknown', () => {
    expect(voiceBandForAge(null)).toBe('adult')
  })
})

describe('setIanMaturity', () => {
  it('moves voice and portrait together', () => {
    setIanMaturity(5)
    expect(voiceBandForAge(getIanAge())).toBe('child')
    expect(ianPortrait('ian')).toMatch(/assets\/ian-garoto-05\.png$/)
    expect(ianPortrait('clara')).toMatch(/assets\/ian-menina-05\.png$/)
  })

  it('uses the baby portrait for age 0 and the fifteen portrait for 15', () => {
    setIanMaturity(0)
    expect(ianPortrait('ian')).toMatch(/ian-garoto-00\.png$/)
    setIanMaturity(15)
    expect(ianPortrait('clara')).toMatch(/ian-menina-15\.png$/)
  })

  it('hides the age in quiet mode', () => {
    setIanMaturity(8, true)
    expect(getIanAge()).toBeNull()
    expect(voiceBandForAge(getIanAge())).toBe('adult')
    expect(ianPortrait('ian')).toMatch(/ian-garoto\.jpg$/)
  })
})
