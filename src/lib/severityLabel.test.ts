import { describe, expect, it } from 'vitest'
import { severityLabelPt } from './severityLabel'

describe('severityLabelPt', () => {
  it('translates known API codes', () => {
    expect(severityLabelPt('Exceeded')).toBe('Excedido')
    expect(severityLabelPt('Attention')).toBe('Atenção')
    expect(severityLabelPt('Limit')).toBe('Limite')
    expect(severityLabelPt('Ok')).toBe('Ok')
    expect(severityLabelPt('Info')).toBe('Info')
  })

  it('keeps unknown codes', () => {
    expect(severityLabelPt('Custom')).toBe('Custom')
  })
})
