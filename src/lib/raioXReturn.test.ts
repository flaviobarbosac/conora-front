import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRaioXReturn, readRaioXReturn, safeRaioXReturnTo, saveRaioXReturn } from './raioXReturn'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  })
})

describe('raioXReturn', () => {
  const valid = {
    path: '/raio-x?competenceYm=2026-10',
    scrollY: 120,
    openIds: ['a', 'b'],
    competenceYm: '2026-10',
    months: 3,
    leakageOnly: true,
  }

  it('saves and reads round-trip', () => {
    saveRaioXReturn(valid)
    expect(readRaioXReturn()).toEqual(valid)
    clearRaioXReturn()
    expect(readRaioXReturn()).toBeNull()
  })

  it('rejects unsafe paths on save and read', () => {
    saveRaioXReturn({ ...valid, path: '//evil' })
    expect(readRaioXReturn()).toBeNull()
    saveRaioXReturn({ ...valid, path: '/orcamento' })
    expect(readRaioXReturn()).toBeNull()
    memory.set('conora:raiox-return', JSON.stringify({ ...valid, path: '/lancamentos' }))
    expect(readRaioXReturn()).toBeNull()
  })

  it('safeRaioXReturnTo only allows /raio-x paths', () => {
    expect(safeRaioXReturnTo('/raio-x')).toBe('/raio-x')
    expect(safeRaioXReturnTo('/raio-x?x=1')).toBe('/raio-x?x=1')
    expect(safeRaioXReturnTo(null)).toBeNull()
    expect(safeRaioXReturnTo('//raio-x')).toBeNull()
    expect(safeRaioXReturnTo('/orcamento')).toBeNull()
  })
})
