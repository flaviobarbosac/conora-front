import { describe, expect, it } from 'vitest'
import {
  buildJornadaTipoTimeline,
  JORNADA_TIPOS,
  JORNADA_TIPOS_ORDERED,
  jornadaTipoPointsTotal,
  portraitAgeFor,
  resolveJornadaTipoId,
} from './jornadaTipos'

describe('jornadaTipos', () => {
  it('lists J0–J5 ordered and each totals 1200 points', () => {
    expect(JORNADA_TIPOS_ORDERED.map((t) => t.id)).toEqual(['J0', 'J1', 'J2', 'J3', 'J4', 'J5'])
    expect(JORNADA_TIPOS).toHaveLength(6)
    for (const tipo of JORNADA_TIPOS) {
      expect(jornadaTipoPointsTotal(tipo)).toBe(1200)
    }
  })

  it('snaps planned ages to existing Ian portraits', () => {
    expect(portraitAgeFor(0)).toBe(0)
    expect(portraitAgeFor(7)).toBe(8)
    expect(portraitAgeFor(14)).toBe(15)
    expect(portraitAgeFor(26)).toBe(22)
    expect(portraitAgeFor(30)).toBe(30)
  })

  it('resolves journey package from diagnosis answers', () => {
    expect(resolveJornadaTipoId(null)).toBe('J0')
    expect(
      resolveJornadaTipoId({
        rendaFixa: false,
        divida: true,
        patrimonio: false,
        projetoVida: false,
      }),
    ).toBe('J3')
    expect(
      resolveJornadaTipoId({
        rendaFixa: true,
        divida: true,
        patrimonio: false,
        projetoVida: false,
      }),
    ).toBe('J4')
    expect(
      resolveJornadaTipoId({
        rendaFixa: true,
        divida: true,
        patrimonio: true,
        projetoVida: true,
      }),
    ).toBe('J2')
    expect(
      resolveJornadaTipoId({
        rendaFixa: true,
        divida: false,
        patrimonio: false,
        projetoVida: true,
      }),
    ).toBe('J1')
    expect(
      resolveJornadaTipoId({
        rendaFixa: true,
        divida: false,
        patrimonio: true,
        projetoVida: true,
      }),
    ).toBe('J5')
  })

  it('builds timeline order and ages from the package', () => {
    const j3 = JORNADA_TIPOS.find((t) => t.id === 'J3')!
    const timeline = buildJornadaTipoTimeline(j3)
    expect(timeline.map((s) => s.id)).toEqual(j3.steps.map((s) => s.stepId))
    expect(timeline[1]?.id).toBe('budget')
    expect(timeline[1]?.points).toBe(180)
    expect(timeline[2]?.id).toBe('first-month')
  })
})
