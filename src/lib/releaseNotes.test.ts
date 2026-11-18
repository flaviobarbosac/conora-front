import { describe, expect, it } from 'vitest'
import { latestRelease, RELEASE_NOTES } from './releaseNotes'

describe('release notes', () => {
  it('starts with 26.105 and keeps the shared-month note and 26.100', () => {
    const current = latestRelease()
    expect(RELEASE_NOTES[0]).toBe(current)
    expect(current.version).toBe('26.105')
    expect(current.date).toBe('18/11/2026')
    const note = current.items.join(' ')
    expect(note).toContain('Cadastros')
    expect(note).toContain('Retrospectiva')
    expect(note.toLowerCase()).not.toContain('console')
    const shared = RELEASE_NOTES.find((release) => release.version === '26.103')
    expect(shared?.date).toBe('17/11/2026')
    expect(shared?.items.join(' ')).toContain('acompanhamento da análise financeira do consultor')
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
