import { describe, expect, it } from 'vitest'
import { conoraWhatsAppHref } from './whatsappLink'

describe('WhatsApp pairing link', () => {
  it('puts the one-time code in the native and web links', () => {
    const message = 'CONORA ABCD2345'
    expect(conoraWhatsAppHref(message, true)).toBe(
      'whatsapp://send?phone=5527998843407&text=CONORA%20ABCD2345',
    )
    expect(conoraWhatsAppHref(message, false)).toBe(
      'https://wa.me/5527998843407?text=CONORA%20ABCD2345',
    )
  })
})
