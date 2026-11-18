import { describe, expect, it } from 'vitest'
import { latestRelease, RELEASE_NOTES } from './releaseNotes'

describe('release notes', () => {
  it('starts with the shared-month steps and keeps 26.100', () => {
    const current = latestRelease()
    expect(RELEASE_NOTES[0]).toBe(current)
    expect(current.version).toBe('26.103')
    expect(current.date).toBe('17/11/2026')
    expect(current.items.join(' ')).toContain('acompanhamento da análise financeira do consultor')
    const previous = RELEASE_NOTES.find((release) => release.version === '26.100')
    expect(previous?.date).toBe('16/11/2026')
    const text = (previous?.items ?? []).join(' ')
    expect(text).toContain('consultor')
    expect(text).toContain('CNPJ')
    expect(text).toContain('código vale uma vez')
    expect(text).toContain('7 dias')
    expect(text).toContain('29,90')
    expect(text).toContain('499')
    expect(text).toContain('menu do perfil')
  })
})
