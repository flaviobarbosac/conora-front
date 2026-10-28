import { describe, expect, it } from 'vitest'
import { resolveModuloFromPath } from './resolveModuloFromPath'

describe('resolveModuloFromPath', () => {
  const items = [
    { path: '/orcamento', label: 'Orçamento' },
    { path: '/projetos', label: 'Projetos de vida' },
  ]

  it('matches longest prefix', () => {
    expect(resolveModuloFromPath('/projetos/abc', items).modulo).toBe('Projetos de vida')
    expect(resolveModuloFromPath('/orcamento', items).modulo).toBe('Orçamento')
  })

  it('falls back when unknown', () => {
    expect(resolveModuloFromPath('/xyz', items, 'Geral').modulo).toBe('Geral')
  })
})
