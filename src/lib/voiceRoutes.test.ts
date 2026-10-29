import { describe, expect, it } from 'vitest'
import { isVoiceRoute } from './voiceRoutes'

describe('isVoiceRoute', () => {
  it('accepts known app routes', () => {
    expect(isVoiceRoute('/')).toBe(true)
    expect(isVoiceRoute('/raio-x')).toBe(true)
    expect(isVoiceRoute('/orcamento')).toBe(true)
    expect(isVoiceRoute('/plano')).toBe(true)
  })

  it('rejects unknown or empty', () => {
    expect(isVoiceRoute(null)).toBe(false)
    expect(isVoiceRoute(undefined)).toBe(false)
    expect(isVoiceRoute('/admin')).toBe(false)
    expect(isVoiceRoute('/raio-x/extra')).toBe(false)
  })
})
