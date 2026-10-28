import { describe, expect, it } from 'vitest'
import { appLinkRoute, consumeAppLinkRoute } from './appLinks'

describe('appLinkRoute', () => {
  it('maps e-mail links to in-app routes', () => {
    expect(appLinkRoute('conora://validar-email?token=ABC123')).toBe('/validar-email?token=ABC123')
    expect(appLinkRoute('conora://redefinir-senha?token=XYZ')).toBe('/redefinir-senha?token=XYZ')
  })

  it('ignores other schemes, pages and links without token', () => {
    expect(appLinkRoute('https://conora.com.br/app/validar-email?token=ABC')).toBeNull()
    expect(appLinkRoute('conora://compartilhar')).toBeNull()
    expect(appLinkRoute('conora://validar-email')).toBeNull()
    expect(appLinkRoute('not a url')).toBeNull()
  })

  it('records consumed routes without throwing', () => {
    expect(() => consumeAppLinkRoute('/validar-email?token=ABC')).not.toThrow()
  })
})
