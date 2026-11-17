import { describe, expect, it } from 'vitest'
import { latestRelease, RELEASE_NOTES } from './releaseNotes'

describe('release notes', () => {
  it('starts with 26.100, the release after 26.1.99', () => {
    const current = latestRelease()
    expect(RELEASE_NOTES[0]).toBe(current)
    expect(current.version).toBe('26.100')
    expect(current.date).toBe('16/11/2026')
    const text = current.items.join(' ')
    expect(text).toContain('consultor')
    expect(text).toContain('CNPJ')
    expect(text).toContain('código vale uma vez')
    expect(text).toContain('7 dias')
    expect(text).toContain('29,90')
    expect(text).toContain('499')
    expect(text).toContain('menu do perfil')
  })
})
