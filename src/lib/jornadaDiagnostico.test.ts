import { describe, expect, it } from 'vitest'
import {
  deferredStepIds,
  isJornadaDiagnosticoComplete,
  orderTimelineStepIds,
  type JornadaDiagnosticoAnswers,
} from './jornadaDiagnostico'

describe('jornadaDiagnostico', () => {
  const full: JornadaDiagnosticoAnswers = {
    rendaFixa: true,
    divida: false,
    patrimonio: true,
    projetoVida: false,
  }

  it('marks complete only when all four answers are boolean', () => {
    expect(isJornadaDiagnosticoComplete(null)).toBe(false)
    expect(isJornadaDiagnosticoComplete({})).toBe(false)
    expect(isJornadaDiagnosticoComplete({ rendaFixa: true })).toBe(false)
    expect(
      isJornadaDiagnosticoComplete({
        rendaFixa: true,
        divida: false,
        patrimonio: true,
      }),
    ).toBe(false)
    expect(isJornadaDiagnosticoComplete(full)).toBe(true)
    expect(
      isJornadaDiagnosticoComplete({
        rendaFixa: false,
        divida: false,
        patrimonio: false,
        projetoVida: false,
      }),
    ).toBe(true)
  })

  it('defers steps answered as não', () => {
    expect([...deferredStepIds(full)].sort()).toEqual(['debt', 'projects'])
  })

  it('orders yes cadastro steps before agora-não', () => {
    const ids = ['start', 'budget', 'debt', 'patrimony', 'projects', 'first-month']
    expect(orderTimelineStepIds(ids, full)).toEqual([
      'start',
      'budget',
      'patrimony',
      'debt',
      'projects',
      'first-month',
    ])
  })
})
