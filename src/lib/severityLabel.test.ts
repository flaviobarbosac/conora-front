import { describe, expect, it } from 'vitest'
import { severityLabelPt } from './severityLabel'

describe('severityLabelPt', () => {
  it('translates Exceeded to Excedido', () => {
    expect(severityLabelPt('Exceeded')).toBe('Excedido')
  })

  it('keeps unknown codes', () => {
    expect(severityLabelPt('Custom')).toBe('Custom')
  })
})
