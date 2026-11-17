export const CONORA_WHATSAPP_E164 = '5527998843407'

export function conoraWhatsAppHref(message: string, native: boolean): string {
  const text = encodeURIComponent(message)
  const phone = CONORA_WHATSAPP_E164
  return native
    ? `whatsapp://send?phone=${phone}&text=${text}`
    : `https://wa.me/${phone}?text=${text}`
}
