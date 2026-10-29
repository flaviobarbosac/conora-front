import { describe, expect, it } from 'vitest'
import { categoryLabel, categoryLabelWithNumber } from './categoryLabel'

describe('categoryLabel', () => {
  it('returns name only by default', () => {
    expect(categoryLabel({ name: 'Aluguel', displayNumber: '1.1' })).toBe('Aluguel')
  })

  it('formats number-name without spaces', () => {
    expect(categoryLabelWithNumber({ name: 'Aluguel', displayNumber: '1.1' })).toBe('1.1-Aluguel')
    expect(categoryLabelWithNumber({ name: 'Aluguel', displayNumber: '  ' })).toBe('Aluguel')
    expect(categoryLabelWithNumber({ name: 'Aluguel', displayNumber: null as never })).toBe('Aluguel')
  })
})
