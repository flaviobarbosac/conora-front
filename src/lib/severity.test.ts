import { describe, expect, it } from 'vitest'
import { toneFromSeverity } from './severity'

describe('toneFromSeverity', () => {
  it('maps known severities', () => {
    expect(toneFromSeverity('Ok')).toBe('ok')
    expect(toneFromSeverity('Attention')).toBe('warning')
    expect(toneFromSeverity('Limit')).toBe('warning')
    expect(toneFromSeverity('Exceeded')).toBe('danger')
    expect(toneFromSeverity('Info')).toBe('info')
    expect(toneFromSeverity('anything')).toBe('info')
  })
})
