import { describe, expect, it } from 'vitest'
import { JORNADA_TIMELINE, journeyKindLabel, journeyPortraitUrl } from './jornadaTimeline'

describe('jornadaTimeline', () => {
  it('has ordered steps from birth to apex', () => {
    expect(JORNADA_TIMELINE[0].kind).toBe('start')
    expect(JORNADA_TIMELINE.at(-1)?.kind).toBe('apex')
    expect(JORNADA_TIMELINE.length).toBeGreaterThanOrEqual(8)
    const ages = JORNADA_TIMELINE.map((s) => s.ianAge)
    for (let i = 1; i < ages.length; i++) {
      expect(ages[i]).toBeGreaterThanOrEqual(ages[i - 1])
    }
  })

  it('labels kinds and builds portrait urls', () => {
    expect(journeyKindLabel('start')).toBe('Início')
    expect(journeyKindLabel('cadastro')).toBe('Cadastro')
    expect(journeyKindLabel('marco')).toBe('Marco')
    expect(journeyKindLabel('apex')).toBe('Ápice')
    expect(journeyPortraitUrl(0)).toContain('ian-garoto-00.png')
    expect(journeyPortraitUrl(30)).toContain('ian-garoto-30.png')
  })
})
